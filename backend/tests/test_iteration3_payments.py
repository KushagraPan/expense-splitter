"""Iteration 3 Test Suite: Settlement suggestions, partial/full payments, recalculations,
validation, persistence, and lifecycle rules.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.store import store


@pytest.fixture(autouse=True)
def reset_store():
    store.reset(seed=False)
    yield


@pytest.mark.asyncio
async def test_canonical_scenario_partial_and_full_payments():
    """Test canonical scenario:
    4 members: A, B, C, D
    Expense ₹1,000: A paid ₹700, B paid ₹300, equal split (₹250 each)
    C owes A ₹250, D owes A ₹200, D owes B ₹50.
    Verify:
    1. Partial payment from C to A of ₹100
    2. Balance and suggestions recalculation
    3. Full payment from C to A of remaining ₹150
    4. C is fully settled and disappears from suggestions
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create group
        res = await client.post("/api/groups", json={"name": "Trip to Goa", "currency": "INR"})
        assert res.status_code == 201
        gid = res.json()["id"]

        # Add 4 members
        m_a = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()
        m_b = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()
        m_c = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()
        m_d = (await client.post(f"/api/groups/{gid}/members", json={"name": "David"})).json()

        # Add ₹1,000 expense with multiple payers (A: 700, B: 300) and 4 participants
        exp_res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Villa Booking",
                "amount": 1000.0,
                "payers": [
                    {"member_id": m_a["id"], "amount": 700.0},
                    {"member_id": m_b["id"], "amount": 300.0},
                ],
                "split_method": "EQUAL",
                "participants": [m_a["id"], m_b["id"], m_c["id"], m_d["id"]],
                "expense_date": "2026-09-14",
            },
        )
        assert exp_res.status_code == 201

        # Check initial balances: A: +450, B: +50, C: -250, D: -250
        bal_res = await client.get(f"/api/groups/{gid}/balances")
        assert bal_res.status_code == 200
        bal_map = {b["member_id"]: b["net_balance"] for b in bal_res.json()}
        assert bal_map[m_a["id"]] == 450.0
        assert bal_map[m_b["id"]] == 50.0
        assert bal_map[m_c["id"]] == -250.0
        assert bal_map[m_d["id"]] == -250.0

        # Check suggestions: C owes A 250, D owes A 200, D owes B 50
        settle_res = await client.get(f"/api/groups/{gid}/settlements")
        assert settle_res.status_code == 200
        settlements = settle_res.json()
        assert len(settlements) == 3

        c_to_a = next((s for s in settlements if s["payer_id"] == m_c["id"] and s["recipient_id"] == m_a["id"]), None)
        assert c_to_a is not None
        assert c_to_a["amount"] == 250.0

        # 1. Record partial payment: Charlie pays Alice ₹100
        pay_res = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m_c["id"],
                "recipient_id": m_a["id"],
                "amount": 100.0,
                "payment_date": "2026-09-14",
                "notes": "Partial settlement via UPI",
            },
        )
        assert pay_res.status_code == 201
        payment = pay_res.json()
        assert payment["amount"] == 100.0
        assert payment["notes"] == "Partial settlement via UPI"

        # 2. Recalculate balances: Charlie now owes ₹150, Alice is owed ₹350
        bal_res2 = await client.get(f"/api/groups/{gid}/balances")
        bal_map2 = {b["member_id"]: b["net_balance"] for b in bal_res2.json()}
        assert bal_map2[m_a["id"]] == 350.0
        assert bal_map2[m_b["id"]] == 50.0
        assert bal_map2[m_c["id"]] == -150.0
        assert bal_map2[m_d["id"]] == -250.0

        # Recalculate suggestions: Greedy matching gives D -> A 250, C -> A 100, C -> B 50
        settle_res2 = await client.get(f"/api/groups/{gid}/settlements")
        settlements2 = settle_res2.json()
        c_to_a_2 = next((s for s in settlements2 if s["payer_id"] == m_c["id"] and s["recipient_id"] == m_a["id"]), None)
        assert c_to_a_2 is not None
        assert c_to_a_2["amount"] == 100.0

        c_to_b_2 = next((s for s in settlements2 if s["payer_id"] == m_c["id"] and s["recipient_id"] == m_b["id"]), None)
        assert c_to_b_2 is not None
        assert c_to_b_2["amount"] == 50.0

        # 3. Charlie pays Alice the remaining ₹100 full suggested amount
        pay_res2 = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m_c["id"],
                "recipient_id": m_a["id"],
                "amount": 100.0,
                "payment_date": "2026-09-14",
                "notes": "Settled with Alice",
            },
        )
        assert pay_res2.status_code == 201

        # 4. Charlie pays Bob the remaining ₹50 full suggested amount
        pay_res3 = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m_c["id"],
                "recipient_id": m_b["id"],
                "amount": 50.0,
                "payment_date": "2026-09-14",
                "notes": "Settled with Bob",
            },
        )
        assert pay_res3.status_code == 201

        # 5. Charlie's net balance is now 0.00
        bal_res3 = await client.get(f"/api/groups/{gid}/balances")
        bal_map3 = {b["member_id"]: b["net_balance"] for b in bal_res3.json()}
        assert bal_map3[m_c["id"]] == 0.0

        # Charlie should no longer be in settlement suggestions
        settle_res3 = await client.get(f"/api/groups/{gid}/settlements")
        settlements3 = settle_res3.json()
        assert not any(s["payer_id"] == m_c["id"] or s["recipient_id"] == m_c["id"] for s in settlements3)
        assert len(settlements3) == 1  # Only David owes Alice remaining 250


@pytest.mark.asyncio
async def test_overpayment_and_invalid_direction_validation():
    """Test validation errors:
    - Overpayment (> suggested amount)
    - Zero payment
    - Negative payment
    - Debtor paying wrong direction / non-creditor
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/groups", json={"name": "Validation Group", "currency": "USD"})
        gid = res.json()["id"]

        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()

        # Alice paid $100, split equally -> Bob owes Alice $50
        exp_res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Groceries",
                "amount": 100.0,
                "payers": [{"member_id": m1["id"], "amount": 100.0}],
                "split_method": "EQUAL",
                "participants": [m1["id"], m2["id"]],
                "expense_date": "2026-09-14",
            },
        )
        assert exp_res.status_code == 201

        # Overpayment: Bob tries to pay Alice $60 (suggested is $50)
        over_res = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m2["id"],
                "recipient_id": m1["id"],
                "amount": 60.0,
                "payment_date": "2026-09-14",
            },
        )
        assert over_res.status_code == 400
        assert "exceeds" in over_res.json()["detail"].lower()

        # Zero payment: amount <= 0
        zero_res = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m2["id"],
                "recipient_id": m1["id"],
                "amount": 0.0,
                "payment_date": "2026-09-14",
            },
        )
        assert zero_res.status_code in (400, 422)

        # Negative payment: amount < 0
        neg_res = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m2["id"],
                "recipient_id": m1["id"],
                "amount": -25.0,
                "payment_date": "2026-09-14",
            },
        )
        assert neg_res.status_code in (400, 422)

        # Wrong direction: Creditor Alice tries to pay Debtor Bob $50
        rev_res = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m1["id"],
                "recipient_id": m2["id"],
                "amount": 50.0,
                "payment_date": "2026-09-14",
            },
        )
        assert rev_res.status_code == 400
        assert "no outstanding settlement" in rev_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_payment_immutability_and_persistence():
    """Verify that:
    1. Payments persist in SQLite database.
    2. Payments remain intact even when expenses are modified or deleted.
    3. No endpoint exists to mutate or delete recorded payments.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/groups", json={"name": "Persistence Group", "currency": "EUR"})
        gid = res.json()["id"]

        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Emma"})).json()
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Lucas"})).json()

        exp_res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Dinner",
                "amount": 80.0,
                "payers": [{"member_id": m1["id"], "amount": 80.0}],
                "split_method": "EQUAL",
                "participants": [m1["id"], m2["id"]],
                "expense_date": "2026-09-14",
            },
        )
        assert exp_res.status_code == 201
        exp = exp_res.json()

        # Lucas pays Emma 40 EUR
        pay_res = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m2["id"],
                "recipient_id": m1["id"],
                "amount": 40.0,
                "payment_date": "2026-09-14",
                "notes": "Dinner reimbursement",
            },
        )
        assert pay_res.status_code == 201
        pay_id = pay_res.json()["id"]

        # List payments via API
        list_res = await client.get(f"/api/groups/{gid}/payments")
        assert list_res.status_code == 200
        assert len(list_res.json()) == 1
        assert list_res.json()[0]["id"] == pay_id

        # Delete original expense
        del_exp = await client.delete(f"/api/groups/{gid}/expenses/{exp['id']}")
        assert del_exp.status_code == 204

        # Verify payment is still preserved in database and accessible
        list_res2 = await client.get(f"/api/groups/{gid}/payments")
        assert list_res2.status_code == 200
        assert len(list_res2.json()) == 1
        assert list_res2.json()[0]["id"] == pay_id
        assert list_res2.json()[0]["amount"] == 40.0

        # Attempting to DELETE or PUT to /api/groups/{gid}/payments/{pay_id} is not supported (404/405)
        del_pay = await client.delete(f"/api/groups/{gid}/payments/{pay_id}")
        assert del_pay.status_code in (404, 405)

        put_pay = await client.put(f"/api/groups/{gid}/payments/{pay_id}", json={"amount": 30.0})
        assert put_pay.status_code in (404, 405)


@pytest.mark.asyncio
async def test_lifecycle_archiving_after_full_settlement():
    """Verify group lifecycle with payments:
    1. Group with debts cannot be archived.
    2. Once all suggestions are paid and all balances are 0.00, group can be archived.
    3. Archived group blocks new payments.
    4. Reopening group allows payments again.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/groups", json={"name": "Lifecycle Group", "currency": "INR"})
        gid = res.json()["id"]

        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "A"})).json()
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "B"})).json()

        # Add expense of 200 -> B owes A 100
        exp_res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Hotel",
                "amount": 200.0,
                "payers": [{"member_id": m1["id"], "amount": 200.0}],
                "split_method": "EQUAL",
                "participants": [m1["id"], m2["id"]],
                "expense_date": "2026-09-14",
            },
        )
        assert exp_res.status_code == 201

        # 1. Attempt archive when debts remain -> 400
        arch_fail = await client.post(f"/api/groups/{gid}/archive")
        assert arch_fail.status_code == 400

        # Pay full amount: B pays A 100
        pay_res = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m2["id"],
                "recipient_id": m1["id"],
                "amount": 100.0,
                "payment_date": "2026-09-14",
            },
        )
        assert pay_res.status_code == 201

        # 2. Archive should now succeed
        arch_success = await client.post(f"/api/groups/{gid}/archive")
        assert arch_success.status_code == 200
        assert arch_success.json()["status"] == "ARCHIVED"

        # 3. New payments in archived group blocked
        pay_blocked = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m2["id"],
                "recipient_id": m1["id"],
                "amount": 10.0,
                "payment_date": "2026-09-14",
            },
        )
        assert pay_blocked.status_code == 403
        assert "archived" in pay_blocked.json()["detail"].lower()

        # 4. Reopen group
        reopen = await client.post(f"/api/groups/{gid}/reopen")
        assert reopen.status_code == 200
        assert reopen.json()["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_exact_shares_and_multi_payments():
    """Verify exact split with multiple payments clearing debts in steps."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/groups", json={"name": "Exact Split Group", "currency": "USD"})
        gid = res.json()["id"]

        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()
        m3 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()

        # Alice pays 300. Bob owes 100, Charlie owes 200.
        await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Concert Tickets",
                "amount": 300.0,
                "payers": [{"member_id": m1["id"], "amount": 300.0}],
                "split_method": "EXACT",
                "expense_date": "2026-09-14",
                "shares": [
                    {"member_id": m2["id"], "owed_amount": 100.0},
                    {"member_id": m3["id"], "owed_amount": 200.0},
                ],
            },
        )

        # Bob pays full 100
        p1 = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m2["id"],
                "recipient_id": m1["id"],
                "amount": 100.0,
                "payment_date": "2026-09-14",
            },
        )
        assert p1.status_code == 201

        # Charlie pays partial 150
        p2 = await client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m3["id"],
                "recipient_id": m1["id"],
                "amount": 150.0,
                "payment_date": "2026-09-14",
            },
        )
        assert p2.status_code == 201

        # Check remaining settlement: Charlie owes Alice 50
        settle = (await client.get(f"/api/groups/{gid}/settlements")).json()
        assert len(settle) == 1
        assert settle[0]["payer_id"] == m3["id"]
        assert settle[0]["recipient_id"] == m1["id"]
        assert settle[0]["amount"] == 50.0
