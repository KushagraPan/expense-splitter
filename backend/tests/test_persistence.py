"""Tests for SQLite persistence, foreign key enforcement, and SQLAlchemy models."""

import os
import tempfile

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.database import Base, set_sqlite_pragma
from app.models import (
    ExpenseModel,
    ExpensePayerModel,
    ExpenseShareModel,
    GroupModel,
    MemberModel,
    PaymentModel,
)
from app.repository import SqlAlchemyRepository
from app.schemas import (
    CreateExpensePayerInput,
    CreateExpenseRequest,
    CreateGroupRequest,
    CreateMemberRequest,
    CreatePaymentRequest,
    GroupStatus,
    SplitMethod,
)


@pytest.fixture
def temp_db():
    """Create a temporary SQLite database for isolated persistence testing."""
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db_url = f"sqlite:///{db_path}"

    test_engine = create_engine(db_url, connect_args={"check_same_thread": False})
    event.listen(test_engine, "connect", set_sqlite_pragma)

    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    yield TestSession, db_url, db_path

    test_engine.dispose()
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except PermissionError:
            pass


def test_sqlite_foreign_keys_prevent_orphaned_members(temp_db):
    TestSession, _, _ = temp_db
    with TestSession() as session:
        bad_member = MemberModel(
            id="mem-bad",
            group_id="non-existent-group",
            name="Ghost",
            created_at="2026-09-13T00:00:00Z",
        )
        session.add(bad_member)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


def test_sqlite_foreign_keys_prevent_orphaned_expense_payers(temp_db):
    TestSession, _, _ = temp_db
    with TestSession() as session:
        group = GroupModel(
            id="grp-test",
            name="Test Group",
            currency="USD",
            status="ACTIVE",
            created_at="2026-09-13T00:00:00Z",
        )
        session.add(group)
        session.commit()

        exp = ExpenseModel(
            id="exp-valid",
            group_id="grp-test",
            title="Dinner",
            amount_cents=5000,
            split_method="EQUAL",
            expense_date="2026-09-13",
            created_at="2026-09-13T00:00:00Z",
        )
        session.add(exp)
        session.commit()

        bad_payer = ExpensePayerModel(
            expense_id="exp-valid",
            member_id="mem-non-existent",
            amount_cents=5000,
        )
        session.add(bad_payer)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


def test_sqlite_group_cascade_delete(temp_db):
    TestSession, _, _ = temp_db
    with TestSession() as session:
        repo = SqlAlchemyRepository(session)
        grp = repo.create_group(CreateGroupRequest(name="Cascade Group", currency="EUR"))
        m1 = repo.add_member(grp.id, CreateMemberRequest(name="Alice"))
        m2 = repo.add_member(grp.id, CreateMemberRequest(name="Bob"))

        repo.create_expense(
            grp.id,
            CreateExpenseRequest(
                title="Lunch",
                amount=40.00,
                payers=[CreateExpensePayerInput(member_id=m1.id, amount=40.00)],
                split_method=SplitMethod.EQUAL,
                participants=[m1.id, m2.id],
            ),
        )

        repo.record_payment(
            grp.id,
            CreatePaymentRequest(
                payer_id=m2.id,
                recipient_id=m1.id,
                amount=20.00,
            ),
        )

        assert session.query(GroupModel).count() == 1
        assert session.query(MemberModel).count() == 2
        assert session.query(ExpenseModel).count() == 1
        assert session.query(ExpensePayerModel).count() == 1
        assert session.query(ExpenseShareModel).count() == 2
        assert session.query(PaymentModel).count() == 1

        grp_model = session.get(GroupModel, grp.id)
        session.delete(grp_model)
        session.commit()

        assert session.query(GroupModel).count() == 0
        assert session.query(MemberModel).count() == 0
        assert session.query(ExpenseModel).count() == 0
        assert session.query(ExpensePayerModel).count() == 0
        assert session.query(ExpenseShareModel).count() == 0
        assert session.query(PaymentModel).count() == 0


def test_integer_cents_storage_in_db(temp_db):
    TestSession, _, _ = temp_db
    with TestSession() as session:
        repo = SqlAlchemyRepository(session)
        grp = repo.create_group(CreateGroupRequest(name="Cents Test", currency="USD"))
        m1 = repo.add_member(grp.id, CreateMemberRequest(name="Alice"))
        m2 = repo.add_member(grp.id, CreateMemberRequest(name="Bob"))

        repo.create_expense(
            grp.id,
            CreateExpenseRequest(
                title="Coffee",
                amount=19.99,
                payers=[CreateExpensePayerInput(member_id=m1.id, amount=19.99)],
                split_method=SplitMethod.EXACT,
                shares=[
                    {"member_id": m1.id, "owed_amount": 10.00},
                    {"member_id": m2.id, "owed_amount": 9.99},
                ],
            ),
        )

        exp_row = session.scalars(select(ExpenseModel)).first()
        assert exp_row is not None
        assert exp_row.amount_cents == 1999
        assert isinstance(exp_row.amount_cents, int)

        payer_rows = session.scalars(select(ExpensePayerModel)).all()
        assert len(payer_rows) == 1
        assert payer_rows[0].amount_cents == 1999
        assert isinstance(payer_rows[0].amount_cents, int)

        share_rows = session.scalars(select(ExpenseShareModel).order_by(ExpenseShareModel.owed_amount_cents.desc())).all()
        assert len(share_rows) == 2
        assert share_rows[0].owed_amount_cents == 1000
        assert share_rows[1].owed_amount_cents == 999
        assert isinstance(share_rows[0].owed_amount_cents, int)


def test_persistence_across_sessions_and_reconnect(temp_db):
    TestSession, db_url, _ = temp_db

    with TestSession() as session1:
        repo1 = SqlAlchemyRepository(session1)
        grp = repo1.create_group(CreateGroupRequest(name="Trip to Tokyo", currency="JPY"))
        gid = grp.id
        m1 = repo1.add_member(gid, CreateMemberRequest(name="Kenji"))
        m2 = repo1.add_member(gid, CreateMemberRequest(name="Yuki"))

        repo1.create_expense(
            gid,
            CreateExpenseRequest(
                title="Shinkansen",
                amount=150.00,
                payers=[CreateExpensePayerInput(member_id=m1.id, amount=150.00)],
                split_method=SplitMethod.EQUAL,
                participants=[m1.id, m2.id],
            ),
        )
        repo1.record_payment(
            gid,
            CreatePaymentRequest(
                payer_id=m2.id,
                recipient_id=m1.id,
                amount=50.00,
            ),
        )

    new_engine = create_engine(db_url, connect_args={"check_same_thread": False})
    NewSession = sessionmaker(autocommit=False, autoflush=False, bind=new_engine)

    with NewSession() as session2:
        repo2 = SqlAlchemyRepository(session2)

        group = repo2.get_group(gid)
        assert group.name == "Trip to Tokyo"
        assert group.currency == "JPY"
        assert group.status == GroupStatus.ACTIVE

        members = repo2.list_members(gid)
        assert len(members) == 2
        names = {m.name for m in members}
        assert names == {"Kenji", "Yuki"}

        expenses = repo2.list_expenses(gid)
        assert len(expenses) == 1
        assert expenses[0].title == "Shinkansen"
        assert expenses[0].amount == 150.00
        assert len(expenses[0].payers) == 1
        assert expenses[0].payers[0].amount == 150.00

        payments = repo2.list_payments(gid)
        assert len(payments) == 1
        assert payments[0].amount == 50.00

        balances = repo2.get_net_balances(gid)
        kenji_bal = next(b for b in balances if b.member_name == "Kenji")
        yuki_bal = next(b for b in balances if b.member_name == "Yuki")
        assert kenji_bal.net_balance == 25.00
        assert yuki_bal.net_balance == -25.00

        suggestions = repo2.get_settlement_suggestions(gid)
        assert len(suggestions) == 1
        assert suggestions[0].payer_name == "Yuki"
        assert suggestions[0].recipient_name == "Kenji"
        assert suggestions[0].amount == 25.00

    new_engine.dispose()


def test_derived_data_is_never_stored_as_table_columns():
    """Verify that NetBalance and SettlementSuggestion are not table columns."""
    for model in [GroupModel, MemberModel, ExpenseModel, ExpensePayerModel, ExpenseShareModel, PaymentModel]:
        column_names = {c.name for c in model.__table__.columns}
        assert "net_balance" not in column_names
        assert "settlement_suggestion" not in column_names
        assert "balance" not in column_names
        assert "suggested_settlement" not in column_names


def test_sqlite_payments_foreign_key_payer_recipient(temp_db):
    """Verify SQLite foreign key enforces payer and recipient must exist in members table."""
    TestSession, _, _ = temp_db
    with TestSession() as session:
        grp = GroupModel(id="grp-fkt", name="FK Test", currency="USD", status="ACTIVE", created_at="2026-09-13T00:00:00Z")
        m1 = MemberModel(id="mem-valid", group_id="grp-fkt", name="Valid", created_at="2026-09-13T00:00:00Z")
        session.add_all([grp, m1])
        session.commit()

        bad_payment = PaymentModel(
            id="pay-bad",
            group_id="grp-fkt",
            payer_id="mem-valid",
            recipient_id="mem-does-not-exist",
            amount_cents=1000,
            payment_date="2026-09-13",
            created_at="2026-09-13T00:00:00Z",
        )
        session.add(bad_payment)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


def test_sqlite_expense_shares_foreign_key_member(temp_db):
    """Verify SQLite foreign key enforces expense share member must exist in members table."""
    TestSession, _, _ = temp_db
    with TestSession() as session:
        grp = GroupModel(id="grp-fks", name="FK Share Test", currency="USD", status="ACTIVE", created_at="2026-09-13T00:00:00Z")
        m1 = MemberModel(id="mem-valid-payer", group_id="grp-fks", name="Payer", created_at="2026-09-13T00:00:00Z")
        exp = ExpenseModel(
            id="exp-fks",
            group_id="grp-fks",
            title="Shared Item",
            amount_cents=2000,
            split_method="EQUAL",
            expense_date="2026-09-13",
            created_at="2026-09-13T00:00:00Z",
        )
        session.add_all([grp, m1, exp])
        session.commit()

        bad_share = ExpenseShareModel(
            expense_id="exp-fks",
            member_id="mem-non-existent-share",
            owed_amount_cents=2000,
        )
        session.add(bad_share)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


def test_persisted_zero_sum_invariant_with_multiple_expenses_and_payments(temp_db):
    """Verify zero-sum invariant holds strictly across multiple persisted expenses and payments."""
    TestSession, _, _ = temp_db
    with TestSession() as session:
        repo = SqlAlchemyRepository(session)
        grp = repo.create_group(CreateGroupRequest(name="Multi Test", currency="USD"))
        m1 = repo.add_member(grp.id, CreateMemberRequest(name="A"))
        m2 = repo.add_member(grp.id, CreateMemberRequest(name="B"))
        m3 = repo.add_member(grp.id, CreateMemberRequest(name="C"))

        repo.create_expense(
            grp.id,
            CreateExpenseRequest(
                title="E1",
                amount=100.00,
                payers=[CreateExpensePayerInput(member_id=m1.id, amount=100.00)],
                split_method=SplitMethod.EQUAL,
                participants=[m1.id, m2.id, m3.id],
            ),
        )
        repo.create_expense(
            grp.id,
            CreateExpenseRequest(
                title="E2",
                amount=45.00,
                payers=[CreateExpensePayerInput(member_id=m2.id, amount=45.00)],
                split_method=SplitMethod.EXACT,
                shares=[
                    {"member_id": m2.id, "owed_amount": 25.00},
                    {"member_id": m3.id, "owed_amount": 20.00},
                ],
            ),
        )

        bals = repo.get_net_balances(grp.id)
        assert sum(round(b.net_balance * 100) for b in bals) == 0


def test_sqlite_multiple_payers_persistence_and_cascade(temp_db):
    """Verify multiple payers are persisted in expense_payers table, queried correctly, and cascade deleted."""
    TestSession, _, _ = temp_db
    with TestSession() as session:
        repo = SqlAlchemyRepository(session)
        grp = repo.create_group(CreateGroupRequest(name="Multi-Payer Group", currency="INR"))
        a = repo.add_member(grp.id, CreateMemberRequest(name="A"))
        b = repo.add_member(grp.id, CreateMemberRequest(name="B"))
        c = repo.add_member(grp.id, CreateMemberRequest(name="C"))
        d = repo.add_member(grp.id, CreateMemberRequest(name="D"))

        # A paid 700, B paid 300, total 1000, shared equally by A, B, C, D
        exp = repo.create_expense(
            grp.id,
            CreateExpenseRequest(
                title="Grand Dinner",
                amount=1000.00,
                payers=[
                    CreateExpensePayerInput(member_id=a.id, amount=700.00),
                    CreateExpensePayerInput(member_id=b.id, amount=300.00),
                ],
                split_method=SplitMethod.EQUAL,
                participants=[a.id, b.id, c.id, d.id],
            ),
        )

        # Verify database records
        payer_rows = session.scalars(
            select(ExpensePayerModel).where(ExpensePayerModel.expense_id == exp.id).order_by(ExpensePayerModel.amount_cents.desc())
        ).all()
        assert len(payer_rows) == 2
        assert payer_rows[0].member_id == a.id
        assert payer_rows[0].amount_cents == 70000
        assert payer_rows[1].member_id == b.id
        assert payer_rows[1].amount_cents == 30000

        # Verify net balances calculated via repository
        balances = repo.get_net_balances(grp.id)
        bal_map = {b.member_id: b.net_balance for b in balances}
        assert bal_map[a.id] == 450.00
        assert bal_map[b.id] == 50.00
        assert bal_map[c.id] == -250.00
        assert bal_map[d.id] == -250.00

        # Verify deletion cascades to expense_payers table
        repo.delete_expense(grp.id, exp.id)
        remaining_payers = session.scalars(select(ExpensePayerModel).where(ExpensePayerModel.expense_id == exp.id)).all()
        assert len(remaining_payers) == 0


def test_simulated_process_restart_persistence(temp_db):
    """Verify that recreating engine and connection preserves complete state."""
    TestSession, db_url, _ = temp_db
    with TestSession() as s1:
        repo1 = SqlAlchemyRepository(s1)
        g = repo1.create_group(CreateGroupRequest(name="Reboot Group", currency="GBP"))
        gid = g.id
        repo1.add_member(gid, CreateMemberRequest(name="Zoe"))

    restart_engine = create_engine(db_url, connect_args={"check_same_thread": False})
    RestartSession = sessionmaker(autocommit=False, autoflush=False, bind=restart_engine)
    with RestartSession() as s2:
        repo2 = SqlAlchemyRepository(s2)
        loaded_g = repo2.get_group(gid)
        assert loaded_g.name == "Reboot Group"
        loaded_members = repo2.list_members(gid)
        assert len(loaded_members) == 1
        assert loaded_members[0].name == "Zoe"
    restart_engine.dispose()

