"""Pydantic Schemas matching the Canonical OpenAPI 3.1 Specification."""

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class GroupStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class SplitMethod(str, Enum):
    EQUAL = "EQUAL"
    EXACT = "EXACT"


class Group(BaseModel):
    id: str = Field(..., description="Unique identifier of the group")
    name: str = Field(..., min_length=1, max_length=100, description="Display name of the group")
    currency: str = Field(..., min_length=3, max_length=3, pattern=r"^[A-Z]{3}$", description="ISO currency code")
    status: GroupStatus = Field(..., description="Lifecycle status of the group")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class CreateGroupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Display name of the group")
    currency: str = Field(default="INR", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$", description="ISO currency code")


class Member(BaseModel):
    id: str = Field(..., description="Unique identifier of the member")
    group_id: str = Field(..., description="Identifier of the group this member belongs to")
    name: str = Field(..., min_length=1, max_length=50, description="Name of the member")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class CreateMemberRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Name of the member to add")


class ExpensePayer(BaseModel):
    expense_id: str = Field(..., description="Identifier of the associated expense")
    member_id: str = Field(..., description="Identifier of the member who paid")
    amount: float = Field(..., gt=0, description="Monetary amount paid by this member")

    model_config = ConfigDict(from_attributes=True)


class CreateExpensePayerInput(BaseModel):
    member_id: str = Field(..., description="Identifier of the paying group member")
    amount: float = Field(..., gt=0, description="Amount paid by this member")


class ExpenseShare(BaseModel):
    expense_id: str = Field(..., description="Identifier of the associated expense")
    member_id: str = Field(..., description="Identifier of the member who owes this share")
    owed_amount: float = Field(..., ge=0, description="Exact monetary share owed by this participant")

    model_config = ConfigDict(from_attributes=True)


class CreateExpenseShareInput(BaseModel):
    member_id: str = Field(..., description="Identifier of the participating group member")
    owed_amount: float = Field(..., ge=0, description="Exact share amount assigned to this participant")


class Expense(BaseModel):
    id: str = Field(..., description="Unique identifier of the expense")
    group_id: str = Field(..., description="Identifier of the group")
    title: str = Field(..., min_length=1, max_length=100, description="Title of the expense")
    amount: float = Field(..., gt=0, description="Total expense amount")
    payers: list[ExpensePayer] = Field(default_factory=list, description="Breakdown of member contributions who paid for this expense")
    split_method: SplitMethod = Field(..., description="Split method used")
    expense_date: str = Field(..., description="Date when expense occurred (YYYY-MM-DD)")
    category: str | None = Field(default=None, max_length=50, description="Optional category")
    notes: str | None = Field(default=None, max_length=255, description="Optional notes")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    updated_at: str | None = Field(default=None, description="ISO 8601 update timestamp")
    shares: list[ExpenseShare] = Field(default_factory=list, description="Participant shares breakdown")

    model_config = ConfigDict(from_attributes=True)


class CreateExpenseRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    payers: list[CreateExpensePayerInput] = Field(..., min_length=1)
    split_method: SplitMethod = Field(...)
    expense_date: str | None = Field(default=None)
    category: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=255)
    participants: list[str] | None = Field(default=None)
    shares: list[CreateExpenseShareInput] | None = Field(default=None)


class UpdateExpenseRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    payers: list[CreateExpensePayerInput] = Field(..., min_length=1)
    split_method: SplitMethod = Field(...)
    expense_date: str | None = Field(default=None)
    category: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=255)
    participants: list[str] | None = Field(default=None)
    shares: list[CreateExpenseShareInput] | None = Field(default=None)


class Payment(BaseModel):
    id: str = Field(..., description="Unique identifier of the payment record")
    group_id: str = Field(..., description="Identifier of the group")
    payer_id: str = Field(..., description="Member ID of the person who paid (debtor)")
    recipient_id: str = Field(..., description="Member ID of the person who received (creditor)")
    amount: float = Field(..., gt=0, description="Amount transferred")
    payment_date: str = Field(..., description="Date when payment occurred (YYYY-MM-DD)")
    notes: str | None = Field(default=None, max_length=255, description="Optional note")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class CreatePaymentRequest(BaseModel):
    payer_id: str = Field(..., description="Member ID of the debtor paying money")
    recipient_id: str = Field(..., description="Member ID of the creditor receiving money")
    amount: float = Field(..., gt=0, description="Amount paid")
    payment_date: str | None = Field(default=None, description="Date payment took place")
    notes: str | None = Field(default=None, max_length=255, description="Optional note or reference")


class NetBalance(BaseModel):
    member_id: str = Field(..., description="Identifier of the group member")
    member_name: str = Field(..., description="Display name of the member")
    net_balance: float = Field(..., description="Derived net balance (Expenses Paid + Payments Sent) - (Expenses Owed + Payments Received)")
    paid_amount: float | None = Field(default=None, ge=0, description="Total expenses paid")
    owed_amount: float | None = Field(default=None, ge=0, description="Total expenses owed")

    model_config = ConfigDict(from_attributes=True)


class SettlementSuggestion(BaseModel):
    payer_id: str = Field(..., description="Member ID of debtor")
    payer_name: str = Field(..., description="Name of debtor")
    recipient_id: str = Field(..., description="Member ID of creditor")
    recipient_name: str = Field(..., description="Name of creditor")
    amount: float = Field(..., gt=0, description="Suggested settlement amount")

    model_config = ConfigDict(from_attributes=True)


class ErrorResponse(BaseModel):
    detail: str = Field(..., description="Explanation of validation or business rule failure")
    code: str | None = Field(default=None, description="Optional error classification code")
