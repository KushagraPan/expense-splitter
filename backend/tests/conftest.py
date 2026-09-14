"""Pytest configuration ensuring test runs use an isolated temporary database.

This protects the development and demo SQLite database (expense_splitter.db)
from being wiped or mutated during automated test execution.
"""

import os
import tempfile
import pytest
from sqlalchemy import create_engine

# Create an isolated temporary SQLite database file for testing
_test_db_fd, _test_db_path = tempfile.mkstemp(suffix="_pytest.db")
os.close(_test_db_fd)
_test_db_url = f"sqlite:///{_test_db_path}"

# Set environment variable so any new Settings() reads this URL
os.environ["EXPENSE_SPLITTER_DATABASE_URL"] = _test_db_url

from app.config import settings
settings.database_url = _test_db_url

from app.database import SessionLocal, init_db, set_sqlite_pragma
from sqlalchemy import event
from sqlalchemy.engine import Engine

test_engine = create_engine(
    _test_db_url,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)

# Ensure SQLite foreign keys are enforced on test engine
@event.listens_for(test_engine, "connect")
def _set_test_sqlite_pragma(dbapi_connection, connection_record):
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    except Exception:
        pass

SessionLocal.configure(bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_db()
    yield
    try:
        test_engine.dispose()
        if os.path.exists(_test_db_path):
            os.remove(_test_db_path)
    except Exception:
        pass
