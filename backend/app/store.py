"""In-Memory Data Store for Expense Splitter FastAPI backend.

Implements all repository operations and domain business rule checks matching
product-spec.md and openapi.yaml.
"""

import random
import string
from datetime import UTC, datetime

from fastapi import HTTPException, status

from app.domain.calculations import (
    calculate_equal_shares,
    calculate_net_balances,
    calculate_settlement_suggestions,
)
from app.schemas import (
    CreateExpenseRequest,
    CreateGroupRequest,
    CreateMemberRequest,
    CreatePaymentRequest,
    Expense,
    ExpenseShare,
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


class InMemoryStore:
    def __init__(self, seed: bool = True):
        self.groups: dict[str, Group] = {}
        self.members: dict[str, Member] = {}
        self.expenses: dict[str, Expense] = {}
        self.payments: dict[str, Payment] = {}
        if seed:
            self._seed_initial_data()

    def reset(self, seed: bool = True):
        self.groups.clear()
        self.members.clear()
        self.expenses.clear()
        self.payments.clear()
        if seed:
            self._seed_initial_data()

    def _seed_initial_data(self):
        # Pre-seed matching frontend prototype
        g_goa = Group(
            id="grp-goa-2026",
            name="Goa Weekend Trip",
            currency="INR",
            status=GroupStatus.ACTIVE,
            created_at="2026-09-10T10:00:00Z",
        )
        g_himalaya = Group(
            id="grp-himalaya-2026",
            name="Himalaya Trek",
            currency="INR",
            status=GroupStatus.ACTIVE,
            created_at="2026-09-12T09:00:00Z",
        )
        g_apt = Group(
            id="grp-apt-4b",
            name="Apartment 4B Utilities",
            currency="USD",
            status=GroupStatus.ACTIVE,
            created_at="2026-09-01T08:30:00Z",
        )
        g_ski = Group(
            id="grp-ski-2025",
            name="Ski Trip 2025",
            currency="EUR",
            status=GroupStatus.ARCHIVED,
            created_at="2025-01-10T10:00:00Z",
        )
        for g in [g_goa, g_himalaya, g_apt, g_ski]:
            self.groups[g.id] = g

        m1 = Member(id="mem-1", group_id="grp-goa-2026", name="Alice", created_at="2026-09-10T10:05:00Z")
        m2 = Member(id="mem-2", group_id="grp-goa-2026", name="Bob", created_at="2026-09-10T10:05:00Z")
        m3 = Member(id="mem-3", group_id="grp-goa-2026", name="Charlie", created_at="2026-09-10T10:05:00Z")
        for m in [m1, m2, m3]:
            self.members[m.id] = m

    # --------------------------------------------------------------------------
    # Groups
    # --------------------------------------------------------------------------
    def list_groups(self) -> list[Group]:
        return list(self.groups.values())

    def get_group(self, group_id: str) -> Group:
        group = self.groups.get(group_id)
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
        group = Group(
            id=group_id,
            name=trimmed_name,
            currency=req.currency.upper().strip(),
            status=GroupStatus.ACTIVE,
            created_at=_now_iso(),
        )
        self.groups[group.id] = group
        return group

    def archive_group(self, group_id: str) -> Group:
        group = self.get_group(group_id)
        if group.status == GroupStatus.ARCHIVED:
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
        group.status = GroupStatus.ARCHIVED
        return group

    def reopen_group(self, group_id: str) -> Group:
        group = self.get_group(group_id)
        if group.status == GroupStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group is already active",
            )
        group.status = GroupStatus.ACTIVE
        return group

    # --------------------------------------------------------------------------
    # Members
    # --------------------------------------------------------------------------
    def list_members(self, group_id: str) -> list[Member]:
        self.get_group(group_id)
        return [m for m in self.members.values() if m.group_id == group_id]

    def add_member(self, group_id: str, req: CreateMemberRequest) -> Member:
        group = self.get_group(group_id)
        if group.status == GroupStatus.ARCHIVED:
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
        member = Member(
            id=_generate_id("mem"),
            group_id=group_id,
            name=trimmed_name,
            created_at=_now_iso(),
        )
        self.members[member.id] = member
        return member

    def delete_member(self, group_id: str, member_id: str) -> None:
        group = self.get_group(group_id)
        if group.status == GroupStatus.ARCHIVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group is archived and read-only",
            )
        member = self.members.get(member_id)
        if not member or member.group_id != group_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Member '{member_id}' not found in group",
            )
        # Check financial history in expenses and payments
        has_expense_history = any(
            e.group_id == group_id and (e.payer_id == member_id or any(s.member_id == member_id for s in e.shares))
            for e in self.expenses.values()
        )
        has_payment_history = any(
            p.group_id == group_id and (p.payer_id == member_id or p.recipient_id == member_id)
            for p in self.payments.values()
        )
        if has_expense_history or has_payment_history:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete member with existing financial history",
            )
        del self.members[member_id]

    # --------------------------------------------------------------------------
    # Expenses
    # --------------------------------------------------------------------------
    def list_expenses(self, group_id: str) -> list[Expense]:
        self.get_group(group_id)
        return [e for e in self.expenses.values() if e.group_id == group_id]

    def get_expense(self, group_id: str, expense_id: str) -> Expense:
        self.get_group(group_id)
        exp = self.expenses.get(expense_id)
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
    ) -> tuple[str, list[ExpenseShare]]:
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

        shares: list[ExpenseShare] = []
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
            shares = calculate_equal_shares(expense_id, amount, participants)
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
                shares.append(
                    ExpenseShare(
                        expense_id=expense_id,
                        member_id=s.member_id,
                        owed_amount=round(s.owed_amount, 2),
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

        return trimmed_title, shares

    def create_expense(self, group_id: str, req: CreateExpenseRequest) -> Expense:
        group = self.get_group(group_id)
        if group.status == GroupStatus.ARCHIVED:
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
        expense = Expense(
            id=expense_id,
            group_id=group_id,
            title=title,
            amount=round(req.amount, 2),
            payer_id=req.payer_id,
            split_method=req.split_method,
            expense_date=exp_date,
            category=req.category.strip() if req.category else None,
            notes=req.notes.strip() if req.notes else None,
            created_at=_now_iso(),
            updated_at=None,
            shares=shares,
        )
        self.expenses[expense.id] = expense
        return expense

    def update_expense(self, group_id: str, expense_id: str, req: UpdateExpenseRequest) -> Expense:
        group = self.get_group(group_id)
        if group.status == GroupStatus.ARCHIVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group is archived and read-only",
            )
        existing = self.get_expense(group_id, expense_id)
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
        exp_date = req.expense_date.strip() if req.expense_date and req.expense_date.strip() else existing.expense_date
        updated = Expense(
            id=expense_id,
            group_id=group_id,
            title=title,
            amount=round(req.amount, 2),
            payer_id=req.payer_id,
            split_method=req.split_method,
            expense_date=exp_date,
            category=req.category.strip() if req.category else None,
            notes=req.notes.strip() if req.notes else None,
            created_at=existing.created_at,
            updated_at=_now_iso(),
            shares=shares,
        )
        self.expenses[expense_id] = updated
        return updated

    def delete_expense(self, group_id: str, expense_id: str) -> None:
        group = self.get_group(group_id)
        if group.status == GroupStatus.ARCHIVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group is archived and read-only",
            )
        self.get_expense(group_id, expense_id)
        del self.expenses[expense_id]

    # --------------------------------------------------------------------------
    # Payments
    # --------------------------------------------------------------------------
    def list_payments(self, group_id: str) -> list[Payment]:
        self.get_group(group_id)
        return [p for p in self.payments.values() if p.group_id == group_id]

    def record_payment(self, group_id: str, req: CreatePaymentRequest) -> Payment:
        group = self.get_group(group_id)
        if group.status == GroupStatus.ARCHIVED:
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
        payment = Payment(
            id=_generate_id("pay"),
            group_id=group_id,
            payer_id=req.payer_id,
            recipient_id=req.recipient_id,
            amount=round(payment_cents / 100.0, 2),
            payment_date=pay_date,
            notes=req.notes.strip() if req.notes else None,
            created_at=_now_iso(),
        )
        self.payments[payment.id] = payment
        return payment

    # --------------------------------------------------------------------------
    # Derived Calculations (Balances & Settlements)
    # --------------------------------------------------------------------------
    def get_net_balances(self, group_id: str) -> list[NetBalance]:
        self.get_group(group_id)
        members = self.list_members(group_id)
        expenses = self.list_expenses(group_id)
        payments = self.list_payments(group_id)
        return calculate_net_balances(members, expenses, payments)

    def get_settlement_suggestions(self, group_id: str) -> list[SettlementSuggestion]:
        balances = self.get_net_balances(group_id)
        return calculate_settlement_suggestions(balances)


# Global store instance
store = InMemoryStore()
