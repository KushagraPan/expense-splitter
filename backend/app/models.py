"""SQLAlchemy 2.0 ORM models for Expense Splitter.

Persists source records with integer cents for monetary values.
Derived data (NetBalance, SettlementSuggestion) is never persisted.
"""

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.schemas import Expense, ExpensePayer, ExpenseShare, Group, GroupStatus, Member, Payment, SplitMethod


class GroupModel(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)

    members: Mapped[list["MemberModel"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    expenses: Mapped[list["ExpenseModel"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    payments: Mapped[list["PaymentModel"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def to_schema(self) -> Group:
        return Group(
            id=self.id,
            name=self.name,
            currency=self.currency,
            status=GroupStatus(self.status),
            created_at=self.created_at,
        )


class MemberModel(Base):
    __tablename__ = "members"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)

    group: Mapped["GroupModel"] = relationship(back_populates="members")

    def to_schema(self) -> Member:
        return Member(
            id=self.id,
            group_id=self.group_id,
            name=self.name,
            created_at=self.created_at,
        )


class ExpenseModel(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    split_method: Mapped[str] = mapped_column(String(20), nullable=False)
    expense_date: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str | None] = mapped_column(String(64), nullable=True)

    group: Mapped["GroupModel"] = relationship(back_populates="expenses")
    payers: Mapped[list["ExpensePayerModel"]] = relationship(
        back_populates="expense",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    shares: Mapped[list["ExpenseShareModel"]] = relationship(
        back_populates="expense",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def to_schema(self) -> Expense:
        return Expense(
            id=self.id,
            group_id=self.group_id,
            title=self.title,
            amount=round(self.amount_cents / 100.0, 2),
            payers=[p.to_schema() for p in self.payers],
            split_method=SplitMethod(self.split_method),
            expense_date=self.expense_date,
            category=self.category,
            notes=self.notes,
            created_at=self.created_at,
            updated_at=self.updated_at,
            shares=[s.to_schema() for s in self.shares],
        )


class ExpensePayerModel(Base):
    __tablename__ = "expense_payers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    expense_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("expenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("members.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    expense: Mapped["ExpenseModel"] = relationship(back_populates="payers")
    member: Mapped["MemberModel"] = relationship(foreign_keys=[member_id])

    def to_schema(self) -> ExpensePayer:
        return ExpensePayer(
            expense_id=self.expense_id,
            member_id=self.member_id,
            amount=round(self.amount_cents / 100.0, 2),
        )


class ExpenseShareModel(Base):
    __tablename__ = "expense_shares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    expense_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("expenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("members.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    owed_amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    expense: Mapped["ExpenseModel"] = relationship(back_populates="shares")
    member: Mapped["MemberModel"] = relationship(foreign_keys=[member_id])

    def to_schema(self) -> ExpenseShare:
        return ExpenseShare(
            expense_id=self.expense_id,
            member_id=self.member_id,
            owed_amount=round(self.owed_amount_cents / 100.0, 2),
        )


class PaymentModel(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payer_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("members.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    recipient_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("members.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_date: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)

    group: Mapped["GroupModel"] = relationship(back_populates="payments")
    payer: Mapped["MemberModel"] = relationship(foreign_keys=[payer_id])
    recipient: Mapped["MemberModel"] = relationship(foreign_keys=[recipient_id])

    def to_schema(self) -> Payment:
        return Payment(
            id=self.id,
            group_id=self.group_id,
            payer_id=self.payer_id,
            recipient_id=self.recipient_id,
            amount=round(self.amount_cents / 100.0, 2),
            payment_date=self.payment_date,
            notes=self.notes,
            created_at=self.created_at,
        )
