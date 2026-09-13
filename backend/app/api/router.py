"""FastAPI Router implementing the canonical OpenAPI 3.1 contract."""

from fastapi import APIRouter, Path, status

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
from app.store import store

router = APIRouter()


# ------------------------------------------------------------------------------
# Groups & Lifecycle
# ------------------------------------------------------------------------------
@router.get(
    "/groups",
    response_model=list[Group],
    tags=["Groups"],
    summary="List all groups",
    operation_id="listGroups",
)
async def list_groups() -> list[Group]:
    return store.list_groups()


@router.post(
    "/groups",
    response_model=Group,
    status_code=status.HTTP_201_CREATED,
    tags=["Groups"],
    summary="Create a new group",
    operation_id="createGroup",
)
async def create_group(request: CreateGroupRequest) -> Group:
    return store.create_group(request)


@router.get(
    "/groups/{id}",
    response_model=Group,
    tags=["Groups"],
    summary="Retrieve group details",
    operation_id="getGroup",
)
async def get_group(
    id: str = Path(..., description="Unique identifier of the group"),
) -> Group:
    return store.get_group(id)


@router.post(
    "/groups/{id}/archive",
    response_model=Group,
    tags=["Groups"],
    summary="Archive a group",
    operation_id="archiveGroup",
)
async def archive_group(
    id: str = Path(..., description="Unique identifier of the group"),
) -> Group:
    return store.archive_group(id)


@router.post(
    "/groups/{id}/reopen",
    response_model=Group,
    tags=["Groups"],
    summary="Reopen an archived group",
    operation_id="reopenGroup",
)
async def reopen_group(
    id: str = Path(..., description="Unique identifier of the group"),
) -> Group:
    return store.reopen_group(id)


# ------------------------------------------------------------------------------
# Members
# ------------------------------------------------------------------------------
@router.get(
    "/groups/{id}/members",
    response_model=list[Member],
    tags=["Members"],
    summary="List group members",
    operation_id="listMembers",
)
async def list_members(
    id: str = Path(..., description="Unique identifier of the group"),
) -> list[Member]:
    return store.list_members(id)


@router.post(
    "/groups/{id}/members",
    response_model=Member,
    status_code=status.HTTP_201_CREATED,
    tags=["Members"],
    summary="Add a member to a group",
    operation_id="addMember",
)
async def add_member(
    request: CreateMemberRequest,
    id: str = Path(..., description="Unique identifier of the group"),
) -> Member:
    return store.add_member(id, request)


@router.delete(
    "/groups/{id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Members"],
    summary="Delete a member from a group",
    operation_id="deleteMember",
)
async def delete_member(
    id: str = Path(..., description="Unique identifier of the group"),
    member_id: str = Path(..., description="Unique identifier of the member"),
) -> None:
    store.delete_member(id, member_id)


# ------------------------------------------------------------------------------
# Expenses
# ------------------------------------------------------------------------------
@router.get(
    "/groups/{id}/expenses",
    response_model=list[Expense],
    tags=["Expenses"],
    summary="List group expenses",
    operation_id="listExpenses",
)
async def list_expenses(
    id: str = Path(..., description="Unique identifier of the group"),
) -> list[Expense]:
    return store.list_expenses(id)


@router.post(
    "/groups/{id}/expenses",
    response_model=Expense,
    status_code=status.HTTP_201_CREATED,
    tags=["Expenses"],
    summary="Create an expense",
    operation_id="createExpense",
)
async def create_expense(
    request: CreateExpenseRequest,
    id: str = Path(..., description="Unique identifier of the group"),
) -> Expense:
    return store.create_expense(id, request)


@router.get(
    "/groups/{id}/expenses/{expense_id}",
    response_model=Expense,
    tags=["Expenses"],
    summary="Retrieve an expense",
    operation_id="getExpense",
)
async def get_expense(
    id: str = Path(..., description="Unique identifier of the group"),
    expense_id: str = Path(..., description="Unique identifier of the expense"),
) -> Expense:
    return store.get_expense(id, expense_id)


@router.put(
    "/groups/{id}/expenses/{expense_id}",
    response_model=Expense,
    tags=["Expenses"],
    summary="Update an expense",
    operation_id="updateExpense",
)
async def update_expense(
    request: UpdateExpenseRequest,
    id: str = Path(..., description="Unique identifier of the group"),
    expense_id: str = Path(..., description="Unique identifier of the expense"),
) -> Expense:
    return store.update_expense(id, expense_id, request)


@router.delete(
    "/groups/{id}/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Expenses"],
    summary="Delete an expense",
    operation_id="deleteExpense",
)
async def delete_expense(
    id: str = Path(..., description="Unique identifier of the group"),
    expense_id: str = Path(..., description="Unique identifier of the expense"),
) -> None:
    store.delete_expense(id, expense_id)


# ------------------------------------------------------------------------------
# Payments
# ------------------------------------------------------------------------------
@router.get(
    "/groups/{id}/payments",
    response_model=list[Payment],
    tags=["Payments"],
    summary="List group payments",
    operation_id="listPayments",
)
async def list_payments(
    id: str = Path(..., description="Unique identifier of the group"),
) -> list[Payment]:
    return store.list_payments(id)


@router.post(
    "/groups/{id}/payments",
    response_model=Payment,
    status_code=status.HTTP_201_CREATED,
    tags=["Payments"],
    summary="Record a settlement payment",
    operation_id="recordPayment",
)
async def record_payment(
    request: CreatePaymentRequest,
    id: str = Path(..., description="Unique identifier of the group"),
) -> Payment:
    return store.record_payment(id, request)


# ------------------------------------------------------------------------------
# Derived Calculations (Balances & Settlements)
# ------------------------------------------------------------------------------
@router.get(
    "/groups/{id}/balances",
    response_model=list[NetBalance],
    tags=["Derived Calculations"],
    summary="Retrieve derived member net balances",
    operation_id="getNetBalances",
)
async def get_net_balances(
    id: str = Path(..., description="Unique identifier of the group"),
) -> list[NetBalance]:
    return store.get_net_balances(id)


@router.get(
    "/groups/{id}/settlements",
    response_model=list[SettlementSuggestion],
    tags=["Derived Calculations"],
    summary="Retrieve simplified settlement suggestions",
    operation_id="getSettlementSuggestions",
)
async def get_settlement_suggestions(
    id: str = Path(..., description="Unique identifier of the group"),
) -> list[SettlementSuggestion]:
    return store.get_settlement_suggestions(id)
