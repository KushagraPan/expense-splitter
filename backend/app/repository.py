"""SQLAlchemy repository for Expense Splitter.

Implements all CRUD and domain operations backed by a SQLAlchemy database session.
Monetary values are stored in the database as integer cents, converted to 2-decimal
floats at the schema boundary. Derived calculations (balances and settlements)
are strictly computed on-the-fly and never persisted as mutable database state.
"""

import random
import string
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.calculations import (
    calculate_equal_shares,
    calculate_net_balances,
    calculate_settlement_suggestions,
)
from app.models import ExpenseModel, ExpenseShareModel, GroupModel, MemberModel, PaymentModel
from app.schemas import (
    CreateExpenseRequest,
    CreateGroupRequest,
    CreateMemberRequest,
    CreatePaymentRequest,
    Expense,
    Group,
    GroupStatus,
    Member,
    NetBalance,
    Payment,
    SettlementSuggestion,
    SplitMethod,
    UpdateExpenseRequest,
)


def _generate_id(prefix: str) -> str:
    timestamp = int(datetime.now(UTC).timestamp() * 1000)
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"{prefix}-{timestamp}-{rand}"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _today_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


def seed_initial_data_if_empty(db: Session) -> None:
    """Seeds initial mock data if the database has no groups."""
    if db.query(GroupModel).count() > 0:
        return

    g_goa = GroupModel(
        id="grp-goa-2026",
        name="Goa Weekend Trip",
        currency="INR",
        status=GroupStatus.ACTIVE.value,
        created_at="2026-09-10T10:00:00Z",
    )
    g_himalaya = GroupModel(
        id="grp-himalaya-2026",
        name="Himalaya Trek",
        currency="INR",
        status=GroupStatus.ACTIVE.value,
        created_at="2026-09-12T09:00:00Z",
    )
    g_apt = GroupModel(
        id="grp-apt-4b",
        name="Apartment 4B Utilities",
        currency="USD",
        status=GroupStatus.ACTIVE.value,
        created_at="2026-09-01T08:30:00Z",
    )
    g_ski = GroupModel(
        id="grp-ski-2025",
        name="Ski Trip 2025",
        currency="EUR",
        status=GroupStatus.ARCHIVED.value,
        created_at="2025-01-10T10:00:00Z",
    )

    db.add_all([g_goa, g_himalaya, g_apt, g_ski])
    db.flush()

    m1 = MemberModel(id="mem-1", group_id="grp-goa-2026", name="Alice", created_at="2026-09-10T10:05:00Z")
    m2 = MemberModel(id="mem-2", group_id="grp-goa-2026", name="Bob", created_at="2026-09-10T10:05:00Z")
    m3 = MemberModel(id="mem-3", group_id="grp-goa-2026", name="Charlie", created_at="2026-09-10T10:05:00Z")
    db.add_all([m1, m2, m3])
    db.commit()


class SqlAlchemyRepository:
    def __init__(self, db: Session):
        self.db = db

    # --------------------------------------------------------------------------
    # Groups
    # --------------------------------------------------------------------------
    def list_groups(self) -> list[Group]:
        stmt = select(GroupModel).order_by(GroupModel.created_at.desc())
        groups = self.db.scalars(stmt).all()
        return [g.to_schema() for g in groups]

    def get_group(self, group_id: str) -> Group:
        group = self.db.get(GroupModel, group_id)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Group '{group_id}' not found",
            )
        return group.to_schema()

    def _get_group_model(self, group_id: str) -> GroupModel:
        group = self.db.get(GroupModel, group_id)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Group '{group_id}' not found",
            )
        return group

    def create_group(self, req: CreateGroupRequest) -> Group:
        trimmed_name = req.name.strip()
        if not trimmed_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group name cannot be empty",
            )
        group_id = _generate_id("grp")
        group = GroupModel(
            id=group_id,
            name=trimmed_name,
            currency=req.currency.upper().strip(),
            status=GroupStatus.ACTIVE.value,
            created_at=_now_iso(),
        )
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group.to_schema()

    def archive_group(self, group_id: str) -> Group:
        group = self._get_group_model(group_id)
        if group.status == GroupStatus.ARCHIVED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Group is already archived",
            )
        balances = self.get_net_balances(group_id)
        has_unsettled = any(abs(b.net_balance) > 0.005 for b in balances)
        if has_unsettled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot archive group with unsettled balances",
            )
        group.status = GroupStatus.ARCHIVED.value
        self.db.commit()
        self.db.refresh(group)
        return group.to_schema()

    def reopen_group(self, group_id: str) -> Group:
        group = self._get_group_model(group_id)
        if group.status == GroupStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group is already active",
            )
        group.status = GroupStatus.ACTIVE.value
        self.db.commit()
        self.db.refresh(group)
        return group.to_schema()

    # --------------------------------------------------------------------------
    # Members
    # --------------------------------------------------------------------------
    def list_members(self, group_id: str) -> list[Member]:
        self._get_group_model(group_id)
        stmt = select(MemberModel).where(MemberModel.group_id == group_id).order_by(MemberModel.created_at.asc())
        members = self.db.scalars(stmt).all()
        return [m.to_schema() for m in members]

    def add_member(self, group_id: str, req: CreateMemberRequest) -> Member:
        group = self._get_group_model(group_id)
        if group.status == GroupStatus.ARCHIVED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group is archived and read-only",
            )
        trimmed_name = req.name.strip()
        if not trimmed_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Member name cannot be empty",
            )
        existing = self.list_members(group_id)
        if any(m.name.lower() == trimmed_name.lower() for m in existing):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Member name must be unique within the group",
            )
        member = MemberModel(
            id=_generate_id("mem"),
            group_id=group_id,
            name=trimmed_name,
            created_at=_now_iso(),
        )
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        return member.to_schema()

    def delete_member(self, group_id: str, member_id: str) -> None:
        group = self._get_group_model(group_id)
        if group.status == GroupStatus.ARCHIVED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group is archived and read-only",
            )
        member = self.db.get(MemberModel, member_id)
        if not member or member.group_id != group_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Member '{member_id}' not found in group",
            )
        # Check financial history in expenses and payments
        has_payer_expense = (
            self.db.query(ExpenseModel)
            .filter(ExpenseModel.group_id == group_id, ExpenseModel.payer_id == member_id)
            .first()
            is not None
        )
        has_share_expense = (
            self.db.query(ExpenseShareModel)
            .join(ExpenseModel, ExpenseShareModel.expense_id == ExpenseModel.id)
            .filter(ExpenseModel.group_id == group_id, ExpenseShareModel.member_id == member_id)
            .first()
            is not None
        )
        has_payment = (
            self.db.query(PaymentModel)
            .filter(
                PaymentModel.group_id == group_id,
                (PaymentModel.payer_id == member_id) | (PaymentModel.recipient_id == member_id),
            )
            .first()
            is not None
        )
        if has_payer_expense or has_share_expense or has_payment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete member with existing financial history",
            )
        self.db.delete(member)
        self.db.commit()

    # --------------------------------------------------------------------------
    # Expenses
    # --------------------------------------------------------------------------
    def list_expenses(self, group_id: str) -> list[Expense]:
        self._get_group_model(group_id)
        stmt = (
            select(ExpenseModel)
            .where(ExpenseModel.group_id == group_id)
            .order_by(ExpenseModel.created_at.desc())
        )
        expenses = self.db.scalars(stmt).all()
        return [e.to_schema() for e in expenses]

    def get_expense(self, group_id: str, expense_id: str) -> Expense:
        self._get_group_model(group_id)
        exp = self.db.get(ExpenseModel, expense_id)
        if not exp or exp.group_id != group_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Expense '{expense_id}' not found in group",
            )
        return exp.to_schema()

    def _get_expense_model(self, group_id: str, expense_id: str) -> ExpenseModel:
        self._get_group_model(group_id)
        exp = self.db.get(ExpenseModel, expense_id)
        if not exp or exp.group_id != group_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Expense '{expense_id}' not found in group",
            )
        return exp

    def _validate_and_build_shares(
        self,
        expense_id: str,
        group_id: str,
        title: str,
        amount: float,
        payer_id: str,
        split_method: SplitMethod,
        participants: list[str] | None,
        shares_input: list | None,
    ) -> tuple[str, list[ExpenseShareModel]]:
        trimmed_title = title.strip()
        if not trimmed_title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Expense title cannot be empty",
            )
        if amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Expense amount must be greater than zero",
            )
        group_member_ids = {m.id for m in self.list_members(group_id)}
        if payer_id not in group_member_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payer must belong to the group",
            )

        share_models: list[ExpenseShareModel] = []
        if split_method == SplitMethod.EQUAL:
            if not participants:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="At least one participant is required",
                )
            for p in participants:
                if p not in group_member_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid participant: member does not belong to group",
                    )
            calculated_shares = calculate_equal_shares(expense_id, amount, participants)
            for s in calculated_shares:
                share_models.append(
                    ExpenseShareModel(
                        expense_id=expense_id,
                        member_id=s.member_id,
                        owed_amount_cents=round(s.owed_amount * 100),
                    )
                )
        elif split_method == SplitMethod.EXACT:
            if not shares_input:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="At least one participant is required",
                )
            total_cents = round(amount * 100)
            sum_cents = 0
            for s in shares_input:
                if s.member_id not in group_member_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid participant: member does not belong to group",
                    )
                if s.owed_amount < 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Share amount must be non-negative",
                    )
                share_cents = round(s.owed_amount * 100)
                sum_cents += share_cents
                share_models.append(
                    ExpenseShareModel(
                        expense_id=expense_id,
                        member_id=s.member_id,
                        owed_amount_cents=share_cents,
                    )
                )
            if sum_cents != total_cents:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Sum of exact shares ({sum_cents / 100:.2f}) must equal expense amount ({total_cents / 100:.2f})",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported split method '{split_method}'",
            )

        return trimmed_title, share_models

    def create_expense(self, group_id: str, req: CreateExpenseRequest) -> Expense:
        group = self._get_group_model(group_id)
        if group.status == GroupStatus.ARCHIVED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group is archived and read-only",
            )
        expense_id = _generate_id("exp")
        title, shares = self._validate_and_build_shares(
            expense_id=expense_id,
            group_id=group_id,
            title=req.title,
            amount=req.amount,
            payer_id=req.payer_id,
            split_method=req.split_method,
            participants=req.participants,
            shares_input=req.shares,
        )
        exp_date = req.expense_date.strip() if req.expense_date and req.expense_date.strip() else _today_iso()
        expense = ExpenseModel(
            id=expense_id,
            group_id=group_id,
            title=title,
            amount_cents=round(req.amount * 100),
            payer_id=req.payer_id,
            split_method=req.split_method.value,
            expense_date=exp_date,
            category=req.category.strip() if req.category else None,
            notes=req.notes.strip() if req.notes else None,
            created_at=_now_iso(),
            updated_at=None,
            shares=shares,
        )
        self.db.add(expense)
        self.db.commit()
        self.db.refresh(expense)
        return expense.to_schema()

    def update_expense(self, group_id: str, expense_id: str, req: UpdateExpenseRequest) -> Expense:
        group = self._get_group_model(group_id)
        if group.status == GroupStatus.ARCHIVED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group is archived and read-only",
            )
        existing = self._get_expense_model(group_id, expense_id)
        title, new_shares = self._validate_and_build_shares(
            expense_id=expense_id,
            group_id=group_id,
            title=req.title,
            amount=req.amount,
            payer_id=req.payer_id,
            split_method=req.split_method,
            participants=req.participants,
            shares_input=req.shares,
        )
        exp_date = req.expense_date.strip() if req.expense_date and req.expense_date.strip() else existing.expense_date
        existing.title = title
        existing.amount_cents = round(req.amount * 100)
        existing.payer_id = req.payer_id
        existing.split_method = req.split_method.value
        existing.expense_date = exp_date
        existing.category = req.category.strip() if req.category else None
        existing.notes = req.notes.strip() if req.notes else None
        existing.updated_at = _now_iso()

        # Update shares: clear existing and re-populate
        existing.shares.clear()
        for s in new_shares:
            existing.shares.append(s)

        self.db.commit()
        self.db.refresh(existing)
        return existing.to_schema()

    def delete_expense(self, group_id: str, expense_id: str) -> None:
        group = self._get_group_model(group_id)
        if group.status == GroupStatus.ARCHIVED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group is archived and read-only",
            )
        exp = self._get_expense_model(group_id, expense_id)
        self.db.delete(exp)
        self.db.commit()

    # --------------------------------------------------------------------------
    # Payments
    # --------------------------------------------------------------------------
    def list_payments(self, group_id: str) -> list[Payment]:
        self._get_group_model(group_id)
        stmt = (
            select(PaymentModel)
            .where(PaymentModel.group_id == group_id)
            .order_by(PaymentModel.created_at.desc())
        )
        payments = self.db.scalars(stmt).all()
        return [p.to_schema() for p in payments]

    def record_payment(self, group_id: str, req: CreatePaymentRequest) -> Payment:
        group = self._get_group_model(group_id)
        if group.status == GroupStatus.ARCHIVED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group is archived and read-only",
            )
        if req.amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment amount must be greater than zero",
            )
        if req.payer_id == req.recipient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payer and recipient cannot be the same member",
            )
        group_member_ids = {m.id for m in self.list_members(group_id)}
        if req.payer_id not in group_member_ids or req.recipient_id not in group_member_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both payer and recipient must belong to the group",
            )

        # Enforce match against current settlement suggestions
        suggestions = self.get_settlement_suggestions(group_id)
        matching = next(
            (s for s in suggestions if s.payer_id == req.payer_id and s.recipient_id == req.recipient_id),
            None,
        )
        if not matching:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No outstanding settlement owed to recipient",
            )

        payment_cents = round(req.amount * 100)
        suggested_cents = round(matching.amount * 100)
        if payment_cents > suggested_cents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment amount exceeds currently suggested settlement amount",
            )

        pay_date = req.payment_date.strip() if req.payment_date and req.payment_date.strip() else _today_iso()
        payment = PaymentModel(
            id=_generate_id("pay"),
            group_id=group_id,
            payer_id=req.payer_id,
            recipient_id=req.recipient_id,
            amount_cents=payment_cents,
            payment_date=pay_date,
            notes=req.notes.strip() if req.notes else None,
            created_at=_now_iso(),
        )
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment.to_schema()

    # --------------------------------------------------------------------------
    # Derived Calculations (Balances & Settlements)
    # --------------------------------------------------------------------------
    def get_net_balances(self, group_id: str) -> list[NetBalance]:
        self._get_group_model(group_id)
        members = self.list_members(group_id)
        expenses = self.list_expenses(group_id)
        payments = self.list_payments(group_id)
        return calculate_net_balances(members, expenses, payments)

    def get_settlement_suggestions(self, group_id: str) -> list[SettlementSuggestion]:
        balances = self.get_net_balances(group_id)
        return calculate_settlement_suggestions(balances)
