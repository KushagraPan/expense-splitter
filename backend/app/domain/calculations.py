"""Pure domain calculation engine for Expense Splitter.

Reference: product-spec.md Sections 14 & 15, calculations.ts.
Enforces safe integer-cent arithmetic to maintain the global zero-sum invariant:
sum(all member net balances) === 0.00
"""

from collections.abc import Iterable

from app.schemas import Expense, ExpenseShare, Member, NetBalance, Payment, SettlementSuggestion


def calculate_net_balances(
    members: Iterable[Member],
    expenses: Iterable[Expense],
    payments: Iterable[Payment] = (),
) -> list[NetBalance]:
    """Calculates net balances for all members of a group from source records.

    Formula:
    Net Balance(M) = (Expenses Paid + Payments Sent) - (Expenses Owed + Payments Received)
    """
    expense_list = list(expenses)
    payment_list = list(payments)

    balances: list[NetBalance] = []

    for member in members:
        paid_cents = 0
        owed_cents = 0
        sent_cents = 0
        received_cents = 0

        for exp in expense_list:
            for payer in exp.payers:
                if payer.member_id == member.id:
                    paid_cents += round(payer.amount * 100)
            for share in exp.shares:
                if share.member_id == member.id:
                    owed_cents += round(share.owed_amount * 100)

        for p in payment_list:
            if p.payer_id == member.id:
                sent_cents += round(p.amount * 100)
            if p.recipient_id == member.id:
                received_cents += round(p.amount * 100)

        net_cents = (paid_cents + sent_cents) - (owed_cents + received_cents)

        net_balance = round(net_cents / 100.0, 2)
        if net_cents == 0:
            net_balance = 0.0

        balances.append(
            NetBalance(
                member_id=member.id,
                member_name=member.name,
                net_balance=net_balance,
                paid_amount=round(paid_cents / 100.0, 2),
                owed_amount=round(owed_cents / 100.0, 2),
            )
        )

    return balances


class _Party:
    def __init__(self, member_id: str, name: str, cents: int):
        self.member_id = member_id
        self.name = name
        self.cents = cents


def calculate_settlement_suggestions(net_balances: Iterable[NetBalance]) -> list[SettlementSuggestion]:
    """Calculates a simplified settlement plan from member net balances using greedy

    debtor-creditor matching. Bounded by <= N - 1 transactions for N members with
    non-zero balances.
    """
    debtors: list[_Party] = []
    creditors: list[_Party] = []

    for b in net_balances:
        cents = round(b.net_balance * 100)
        if cents < 0:
            debtors.append(_Party(b.member_id, b.member_name, abs(cents)))
        elif cents > 0:
            creditors.append(_Party(b.member_id, b.member_name, cents))

    # Sort debtors descending by debt amount (largest debt first)
    debtors.sort(key=lambda d: d.cents, reverse=True)
    # Sort creditors descending by credit amount (largest credit first)
    creditors.sort(key=lambda c: c.cents, reverse=True)

    suggestions: list[SettlementSuggestion] = []
    d_idx = 0
    c_idx = 0

    while d_idx < len(debtors) and c_idx < len(creditors):
        debtor = debtors[d_idx]
        creditor = creditors[c_idx]

        transfer_cents = min(debtor.cents, creditor.cents)

        if transfer_cents > 0:
            suggestions.append(
                SettlementSuggestion(
                    payer_id=debtor.member_id,
                    payer_name=debtor.name,
                    recipient_id=creditor.member_id,
                    recipient_name=creditor.name,
                    amount=round(transfer_cents / 100.0, 2),
                )
            )

        debtor.cents -= transfer_cents
        creditor.cents -= transfer_cents

        if debtor.cents == 0:
            d_idx += 1
        if creditor.cents == 0:
            c_idx += 1

    return suggestions


def calculate_equal_shares(expense_id: str, amount: float, participants: list[str]) -> list[ExpenseShare]:
    """Calculates EQUAL split participant shares distributing sequential remainder cents

    starting from the first participant.
    """
    if not participants:
        raise ValueError("At least one participant is required")

    total_cents = round(amount * 100)
    n = len(participants)
    base_cents = total_cents // n
    remainder_cents = total_cents % n

    shares: list[ExpenseShare] = []
    for i, member_id in enumerate(participants):
        share_cents = base_cents + (1 if i < remainder_cents else 0)
        shares.append(
            ExpenseShare(
                expense_id=expense_id,
                member_id=member_id,
                owed_amount=round(share_cents / 100.0, 2),
            )
        )
    return shares
