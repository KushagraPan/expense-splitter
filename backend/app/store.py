"""Store interface for Expense Splitter backed by SQLite / SQLAlchemy.

Maintains backward-compatibility with existing tests and scripts while delegating
all operations to the SQLAlchemy repository layer.
"""

from app.database import SessionLocal, init_db
from app.models import ExpenseModel, ExpenseShareModel, GroupModel, MemberModel, PaymentModel
from app.repository import SqlAlchemyRepository, seed_initial_data_if_empty
from app.schemas import (
    CreateExpenseRequest,
    CreateGroupRequest,
    CreateMemberRequest,
    CreatePaymentRequest,
    Expense,
    Group,
    Member,
    NetBalance,
    Payment,
    SettlementSuggestion,
    UpdateExpenseRequest,
)


class SqlAlchemyStore:
    def __init__(self, seed: bool = True):
        init_db()
        if seed:
            with SessionLocal() as db:
                seed_initial_data_if_empty(db)

    def reset(self, seed: bool = True) -> None:
        """Reset all tables in the database. Used by test suites."""
        init_db()
        with SessionLocal() as db:
            db.query(ExpenseShareModel).delete()
            db.query(ExpenseModel).delete()
            db.query(PaymentModel).delete()
            db.query(MemberModel).delete()
            db.query(GroupModel).delete()
            db.commit()
            if seed:
                seed_initial_data_if_empty(db)

    def list_groups(self) -> list[Group]:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).list_groups()

    def get_group(self, group_id: str) -> Group:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).get_group(group_id)

    def create_group(self, req: CreateGroupRequest) -> Group:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).create_group(req)

    def archive_group(self, group_id: str) -> Group:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).archive_group(group_id)

    def reopen_group(self, group_id: str) -> Group:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).reopen_group(group_id)

    def list_members(self, group_id: str) -> list[Member]:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).list_members(group_id)

    def add_member(self, group_id: str, req: CreateMemberRequest) -> Member:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).add_member(group_id, req)

    def delete_member(self, group_id: str, member_id: str) -> None:
        with SessionLocal() as db:
            SqlAlchemyRepository(db).delete_member(group_id, member_id)

    def list_expenses(self, group_id: str) -> list[Expense]:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).list_expenses(group_id)

    def get_expense(self, group_id: str, expense_id: str) -> Expense:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).get_expense(group_id, expense_id)

    def create_expense(self, group_id: str, req: CreateExpenseRequest) -> Expense:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).create_expense(group_id, req)

    def update_expense(self, group_id: str, expense_id: str, req: UpdateExpenseRequest) -> Expense:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).update_expense(group_id, expense_id, req)

    def delete_expense(self, group_id: str, expense_id: str) -> None:
        with SessionLocal() as db:
            SqlAlchemyRepository(db).delete_expense(group_id, expense_id)

    def list_payments(self, group_id: str) -> list[Payment]:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).list_payments(group_id)

    def record_payment(self, group_id: str, req: CreatePaymentRequest) -> Payment:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).record_payment(group_id, req)

    def get_net_balances(self, group_id: str) -> list[NetBalance]:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).get_net_balances(group_id)

    def get_settlement_suggestions(self, group_id: str) -> list[SettlementSuggestion]:
        with SessionLocal() as db:
            return SqlAlchemyRepository(db).get_settlement_suggestions(group_id)


# Global store instance backed by SQLite
store = SqlAlchemyStore(seed=True)
