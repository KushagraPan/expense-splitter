"""Database configuration and session management using SQLAlchemy 2.0.

Configures SQLite with foreign key constraints enabled via event listener.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy declarative models."""


# Connect arguments: check_same_thread=False is required for SQLite with multi-threaded FastAPI
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=False,
)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record) -> None:
    """Ensure SQLite enforces foreign key constraints on every connection."""
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    except (DBAPIError, AttributeError):
        pass


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a SQLAlchemy session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(target_engine: Engine | None = None) -> None:
    """Initialize database tables with non-destructive schema migration."""
    eng = target_engine or engine
    Base.metadata.create_all(bind=eng)

    # Non-destructive migration for SQLite when migrating from single-payer to multiple-payer model
    try:
        with eng.connect() as conn:
            res = conn.execute(text("PRAGMA table_info(expenses)")).fetchall()
            col_names = [row[1] for row in res]
            if "payer_id" in col_names:
                conn.execute(text("PRAGMA foreign_keys=OFF"))
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS new_expenses (
                            id VARCHAR(64) NOT NULL PRIMARY KEY,
                            group_id VARCHAR(64) NOT NULL,
                            title VARCHAR(100) NOT NULL,
                            amount_cents INTEGER NOT NULL,
                            split_method VARCHAR(20) NOT NULL,
                            expense_date VARCHAR(20) NOT NULL,
                            category VARCHAR(50),
                            notes VARCHAR(255),
                            created_at VARCHAR(64) NOT NULL,
                            updated_at VARCHAR(64),
                            FOREIGN KEY(group_id) REFERENCES groups (id) ON DELETE CASCADE
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        INSERT INTO new_expenses (id, group_id, title, amount_cents, split_method, expense_date, category, notes, created_at, updated_at)
                        SELECT id, group_id, title, amount_cents, split_method, expense_date, category, notes, created_at, updated_at
                        FROM expenses
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        INSERT INTO expense_payers (expense_id, member_id, amount_cents)
                        SELECT id, payer_id, amount_cents FROM expenses
                        WHERE id NOT IN (SELECT DISTINCT expense_id FROM expense_payers)
                        """
                    )
                )
                conn.execute(text("DROP TABLE expenses"))
                conn.execute(text("ALTER TABLE new_expenses RENAME TO expenses"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_expenses_group_id ON expenses (group_id)"))
                conn.commit()
                conn.execute(text("PRAGMA foreign_keys=ON"))
    except Exception:
        # If migration is not needed or already executed, ignore safely
        pass
