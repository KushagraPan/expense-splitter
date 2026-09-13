"""Unit tests for pure domain calculation engine."""

import pytest

from app.domain.calculations import (
    calculate_equal_shares,
    calculate_net_balances,
    calculate_settlement_suggestions,
)
from app.schemas import Expense, ExpenseShare, Member, Payment, SplitMethod


def test_equal_split_remainder_allocation():
    # AC-E1: 100 split among 3 members: first gets 33.34, next two get 33.33
    shares = calculate_equal_shares("exp-1", 100.00, ["mem-1", "mem-2", "mem-3"])
    assert len(shares) == 3
    assert shares[0].owed_amount == 33.34
    assert shares[1].owed_amount == 33.33
    assert shares[2].owed_amount == 33.33
    assert sum(round(s.owed_amount * 100) for s in shares) == 10000


def test_equal_split_empty_participants_raises():
    with pytest.raises(ValueError, match="At least one participant is required"):
        calculate_equal_shares("exp-1", 50.00, [])


def test_net_balances_zero_sum_invariant():
    members = [
        Member(id="m1", group_id="g1", name="Alice", created_at="2026-09-10T10:00:00Z"),
        Member(id="m2", group_id="g1", name="Bob", created_at="2026-09-10T10:00:00Z"),
        Member(id="m3", group_id="g1", name="Charlie", created_at="2026-09-10T10:00:00Z"),
    ]
    # Alice pays 100, split equally
    shares1 = calculate_equal_shares("exp-1", 100.00, ["m1", "m2", "m3"])
    exp1 = Expense(
        id="exp-1",
        group_id="g1",
        title="Dinner",
        amount=100.00,
        payer_id="m1",
        split_method=SplitMethod.EQUAL,
        expense_date="2026-09-10",
        created_at="2026-09-10T10:00:00Z",
        shares=shares1,
    )
    # Bob pays 60, split between Bob and Charlie (30 each)
    shares2 = [
        ExpenseShare(expense_id="exp-2", member_id="m2", owed_amount=30.00),
        ExpenseShare(expense_id="exp-2", member_id="m3", owed_amount=30.00),
    ]
    exp2 = Expense(
        id="exp-2",
        group_id="g1",
        title="Taxi",
        amount=60.00,
        payer_id="m2",
        split_method=SplitMethod.EXACT,
        expense_date="2026-09-10",
        created_at="2026-09-10T11:00:00Z",
        shares=shares2,
    )

    balances = calculate_net_balances(members, [exp1, exp2], [])
    # Check zero-sum invariant: sum(net_balance) == 0.00
    sum_cents = sum(round(b.net_balance * 100) for b in balances)
    assert sum_cents == 0

    alice_bal = next(b for b in balances if b.member_id == "m1")
    bob_bal = next(b for b in balances if b.member_id == "m2")
    charlie_bal = next(b for b in balances if b.member_id == "m3")

    # Alice paid 100, owes 33.34 -> net +66.66
    assert alice_bal.net_balance == 66.66
    # Bob paid 60, owes 33.33 + 30.00 = 63.33 -> net -3.33
    assert bob_bal.net_balance == -3.33
    # Charlie paid 0, owes 33.33 + 30.00 = 63.33 -> net -63.33
    assert charlie_bal.net_balance == -63.33


def test_settlement_suggestions_greedy_bound():
    members = [
        Member(id="m1", group_id="g1", name="Alice", created_at="2026-09-10T10:00:00Z"),
        Member(id="m2", group_id="g1", name="Bob", created_at="2026-09-10T10:00:00Z"),
        Member(id="m3", group_id="g1", name="Charlie", created_at="2026-09-10T10:00:00Z"),
    ]
    shares = calculate_equal_shares("exp-1", 90.00, ["m1", "m2", "m3"])
    exp = Expense(
        id="exp-1",
        group_id="g1",
        title="Hotel",
        amount=90.00,
        payer_id="m1",
        split_method=SplitMethod.EQUAL,
        expense_date="2026-09-10",
        created_at="2026-09-10T10:00:00Z",
        shares=shares,
    )
    balances = calculate_net_balances(members, [exp], [])
    suggestions = calculate_settlement_suggestions(balances)

    # 3 members, non-zero balances: Alice (+60), Bob (-30), Charlie (-30)
    # Bounded by <= N - 1 = 2 transactions
    assert len(suggestions) <= 2
    total_suggested = sum(s.amount for s in suggestions)
    assert total_suggested == 60.00


def test_debt_inversion_when_expense_deleted_with_payment():
    members = [
        Member(id="m1", group_id="g1", name="Alice", created_at="2026-09-10T10:00:00Z"),
        Member(id="m2", group_id="g1", name="Bob", created_at="2026-09-10T10:00:00Z"),
    ]
    # Bob owes Alice 100
    shares = [ExpenseShare(expense_id="exp-1", member_id="m2", owed_amount=100.00)]
    exp = Expense(
        id="exp-1",
        group_id="g1",
        title="Tickets",
        amount=100.00,
        payer_id="m1",
        split_method=SplitMethod.EXACT,
        expense_date="2026-09-10",
        created_at="2026-09-10T10:00:00Z",
        shares=shares,
    )
    # Bob records payment of 60 to Alice
    payment = Payment(
        id="pay-1",
        group_id="g1",
        payer_id="m2",
        recipient_id="m1",
        amount=60.00,
        payment_date="2026-09-10",
        created_at="2026-09-10T11:00:00Z",
    )

    # Pre-deletion balances: Bob: -40, Alice: +40
    pre_balances = calculate_net_balances(members, [exp], [payment])
    assert next(b for b in pre_balances if b.member_id == "m1").net_balance == 40.00
    assert next(b for b in pre_balances if b.member_id == "m2").net_balance == -40.00

    # If expense is deleted, expenses = []
    balances = calculate_net_balances(members, [], [payment])
    alice_bal = next(b for b in balances if b.member_id == "m1")
    bob_bal = next(b for b in balances if b.member_id == "m2")

    # Bob sent 60, owed 0 -> net +60
    assert bob_bal.net_balance == 60.00
    # Alice received 60, owed 0 -> net -60
    assert alice_bal.net_balance == -60.00

    suggestions = calculate_settlement_suggestions(balances)
    assert len(suggestions) == 1
    assert suggestions[0].payer_id == "m1"
    assert suggestions[0].recipient_id == "m2"
    assert suggestions[0].amount == 60.00
