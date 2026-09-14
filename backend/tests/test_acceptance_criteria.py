"""Explicit verification of Acceptance Criteria (AC-G1..AC-A4) and Edge Cases (EC-01..EC-15).

Reference: product-spec.md Sections 22 and 23.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.store import store


@pytest.fixture(autouse=True)
def reset_db():
    store.reset(seed=False)
    yield


# ==============================================================================
# Edge Cases Matrix (EC-01 to EC-15)
# ==============================================================================
@pytest.mark.asyncio
async def test_ec_01_zero_value_expense():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "USD"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={"title": "Zero", "amount": 0.00, "payers": [{"member_id": m1, "amount": 0.00}], "split_method": "EQUAL", "participants": [m1]},
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_ec_02_negative_expense_or_payment():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "USD"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        # Negative expense
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={"title": "Neg", "amount": -15.00, "payers": [{"member_id": m1, "amount": -15.00}], "split_method": "EQUAL", "participants": [m1, m2]},
        )
        assert res.status_code == 400

        # Negative payment
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m2, "recipient_id": m1, "amount": -10.00},
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_ec_03_zero_value_payment():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "USD"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m2, "recipient_id": m1, "amount": 0.00},
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_ec_04_payer_not_in_participants():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "USD"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]
        m3 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()["id"]

        # Alice pays 300 for Bob and Charlie (Alice excluded)
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={"title": "Tickets", "amount": 300.00, "payers": [{"member_id": m1, "amount": 300.00}], "split_method": "EQUAL", "participants": [m2, m3]},
        )
        assert res.status_code == 201

        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        assert next(b for b in bals if b["member_id"] == m1)["net_balance"] == 300.00
        assert next(b for b in bals if b["member_id"] == m2)["net_balance"] == -150.00
        assert next(b for b in bals if b["member_id"] == m3)["net_balance"] == -150.00


@pytest.mark.asyncio
async def test_ec_05_single_participant_is_payer():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "USD"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]

        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={"title": "Solo Snack", "amount": 50.00, "payers": [{"member_id": m1, "amount": 50.00}], "split_method": "EQUAL", "participants": [m1]},
        )
        assert res.status_code == 201

        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        assert next(b for b in bals if b["member_id"] == m1)["net_balance"] == 0.00


@pytest.mark.asyncio
async def test_ec_06_remainder_penny_distribution():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "INR"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]
        m3 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()["id"]

        # 100.00 split EQUAL among 3: Alice: 33.34, Bob: 33.33, Charlie: 33.33
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={"title": "Dinner", "amount": 100.00, "payers": [{"member_id": m1, "amount": 100.00}], "split_method": "EQUAL", "participants": [m1, m2, m3]},
        )
        assert res.status_code == 201
        exp = res.json()
        assert exp["shares"][0]["owed_amount"] == 33.34
        assert exp["shares"][1]["owed_amount"] == 33.33
        assert exp["shares"][2]["owed_amount"] == 33.33


@pytest.mark.asyncio
async def test_ec_07_exact_split_sum_mismatch():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "USD"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Taxi",
                "amount": 100.00,
                "payers": [{"member_id": m1, "amount": 100.00}],
                "split_method": "EXACT",
                "shares": [
                    {"member_id": m1, "owed_amount": 40.00},
                    {"member_id": m2, "owed_amount": 50.00},
                ],
            },
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_ec_08_and_09_member_deletion_rules():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "USD"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]
        m3 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()["id"]

        # Add expense involving Alice and Bob
        await client.post(
            f"/api/groups/{gid}/expenses",
            json={"title": "Dinner", "amount": 50.00, "payers": [{"member_id": m1, "amount": 50.00}], "split_method": "EQUAL", "participants": [m1, m2]},
        )

        # EC-08: Deleting Alice or Bob is blocked
        assert (await client.delete(f"/api/groups/{gid}/members/{m1}")).status_code == 400
        assert (await client.delete(f"/api/groups/{gid}/members/{m2}")).status_code == 400

        # EC-09: Deleting Charlie (unreferenced) succeeds
        assert (await client.delete(f"/api/groups/{gid}/members/{m3}")).status_code == 204


@pytest.mark.asyncio
async def test_ec_10_and_11_payment_rules():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "USD"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]
        m3 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()["id"]

        # Alice pays 100 for Bob
        await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Hotel",
                "amount": 100.00,
                "payers": [{"member_id": m1, "amount": 100.00}],
                "split_method": "EXACT",
                "shares": [{"member_id": m2, "owed_amount": 100.00}],
            },
        )

        # EC-10: Overpayment (100.01 > 100.00) rejected
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m2, "recipient_id": m1, "amount": 100.01},
        )
        assert res.status_code == 400

        # EC-11: Payment to non-creditor (Bob paying Charlie who is owed nothing) rejected
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m2, "recipient_id": m3, "amount": 50.00},
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_ec_12_archive_with_cent_balance():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "INR"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        # Alice pays 0.01 for Bob
        await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Penny",
                "amount": 0.01,
                "payers": [{"member_id": m1, "amount": 0.01}],
                "split_method": "EXACT",
                "shares": [{"member_id": m2, "owed_amount": 0.01}],
            },
        )

        # Archive blocked
        res = await client.post(f"/api/groups/{gid}/archive")
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_ec_15_duplicate_member_name_in_group():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "USD"})).json()["id"]
        res = await client.post(f"/api/groups/{gid}/members", json={"name": "Dave"})
        assert res.status_code == 201

        res = await client.post(f"/api/groups/{gid}/members", json={"name": "dave"})
        assert res.status_code == 400


# ==============================================================================
# Acceptance Criteria Walkthrough (AC-G1 to AC-A4)
# ==============================================================================
@pytest.mark.asyncio
async def test_ac_g1_create_group():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/groups", json={"name": "Goa Trip", "currency": "INR"})
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Goa Trip"
        assert data["currency"] == "INR"
        assert data["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_ac_e1_equal_split_and_balances():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "INR"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]
        m3 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()["id"]

        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={"title": "Buffet", "amount": 100.00, "payers": [{"member_id": m1, "amount": 100.00}], "split_method": "EQUAL", "participants": [m1, m2, m3]},
        )
        assert res.status_code == 201

        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        alice_b = next(b for b in bals if b["member_id"] == m1)
        bob_b = next(b for b in bals if b["member_id"] == m2)
        charlie_b = next(b for b in bals if b["member_id"] == m3)

        assert alice_b["net_balance"] == 66.66
        assert bob_b["net_balance"] == -33.33
        assert charlie_b["net_balance"] == -33.33


@pytest.mark.asyncio
async def test_ac_e2_exact_split_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "INR"})).json()["id"]
        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Hotel",
                "amount": 100.00,
                "payers": [{"member_id": m1, "amount": 100.00}],
                "split_method": "EXACT",
                "shares": [
                    {"member_id": m1, "owed_amount": 40.00},
                    {"member_id": m2, "owed_amount": 60.00},
                ],
            },
        )
        assert res.status_code == 201

        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        assert next(b for b in bals if b["member_id"] == m1)["net_balance"] == 60.00
        assert next(b for b in bals if b["member_id"] == m2)["net_balance"] == -60.00


@pytest.mark.asyncio
async def test_ac_s1_settlement_suggestions():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "INR"})).json()["id"]
        m_alice = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m_bob = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]
        m_charlie = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()["id"]

        # Alice: +100, Bob: +50, Charlie: -150
        # Alice pays 100 for Charlie
        await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Expense 1",
                "amount": 100.00,
                "payers": [{"member_id": m_alice, "amount": 100.00}],
                "split_method": "EXACT",
                "shares": [{"member_id": m_charlie, "owed_amount": 100.00}],
            },
        )
        # Bob pays 50 for Charlie
        await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Expense 2",
                "amount": 50.00,
                "payers": [{"member_id": m_bob, "amount": 50.00}],
                "split_method": "EXACT",
                "shares": [{"member_id": m_charlie, "owed_amount": 50.00}],
            },
        )

        res = await client.get(f"/api/groups/{gid}/settlements")
        assert res.status_code == 200
        suggs = res.json()
        assert len(suggs) == 2

        # Suggestions: Charlie pays Alice 100, Charlie pays Bob 50
        assert any(s["payer_id"] == m_charlie and s["recipient_id"] == m_alice and s["amount"] == 100.00 for s in suggs)
        assert any(s["payer_id"] == m_charlie and s["recipient_id"] == m_bob and s["amount"] == 50.00 for s in suggs)


@pytest.mark.asyncio
async def test_ac_ed1_expense_edit_preserves_payment():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Trip", "currency": "INR"})).json()["id"]
        m_alice = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m_bob = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        # Expense: Bob owes Alice 100
        exp_res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Dinner",
                "amount": 100.00,
                "payers": [{"member_id": m_alice, "amount": 100.00}],
                "split_method": "EXACT",
                "shares": [{"member_id": m_bob, "owed_amount": 100.00}],
            },
        )
        exp_id = exp_res.json()["id"]

        # Bob pays 100 to Alice
        await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_bob, "recipient_id": m_alice, "amount": 100.00},
        )

        # Expense is edited to 150
        res = await client.put(
            f"/api/groups/{gid}/expenses/{exp_id}",
            json={
                "title": "Dinner (Grand)",
                "amount": 150.00,
                "payers": [{"member_id": m_alice, "amount": 150.00}],
                "split_method": "EXACT",
                "shares": [{"member_id": m_bob, "owed_amount": 150.00}],
            },
        )
        assert res.status_code == 200

        # Bob net is -50, Alice net is +50
        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        assert next(b for b in bals if b["member_id"] == m_bob)["net_balance"] == -50.00
        assert next(b for b in bals if b["member_id"] == m_alice)["net_balance"] == 50.00

        # Suggestion: Bob pays Alice 50
        suggs = (await client.get(f"/api/groups/{gid}/settlements")).json()
        assert len(suggs) == 1
        assert suggs[0]["payer_id"] == m_bob
        assert suggs[0]["recipient_id"] == m_alice
        assert suggs[0]["amount"] == 50.00


@pytest.mark.asyncio
async def test_ac_a4_reopen_group_restores_mutations():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Reopen Group", "currency": "USD"})).json()["id"]
        await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})

        # Archive group (zero balances)
        assert (await client.post(f"/api/groups/{gid}/archive")).status_code == 200

        # Reopen group
        res = await client.post(f"/api/groups/{gid}/reopen")
        assert res.status_code == 200
        assert res.json()["status"] == "ACTIVE"

        # Mutations restored
        res = await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})
        assert res.status_code == 201


# ==============================================================================
# Iteration 2: Multiple Payers Acceptance Criteria
# ==============================================================================
@pytest.mark.asyncio
async def test_ac_multiple_payers_canonical_scenario():
    """Human-approved canonical scenario:
    A pays ₹700, B pays ₹300, Total ₹1,000, A/B/C/D participate, Equal split.
    Expected: A +450, B +50, C -250, D -250.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Roommates", "currency": "INR"})).json()["id"]
        a = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        b = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]
        c = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()["id"]
        d = (await client.post(f"/api/groups/{gid}/members", json={"name": "Dave"})).json()["id"]

        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Groceries & Dinner",
                "amount": 1000.00,
                "payers": [
                    {"member_id": a, "amount": 700.00},
                    {"member_id": b, "amount": 300.00},
                ],
                "split_method": "EQUAL",
                "participants": [a, b, c, d],
            },
        )
        assert res.status_code == 201
        exp_data = res.json()
        assert len(exp_data["payers"]) == 2
        assert exp_data["amount"] == 1000.00

        # Check balances
        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        bal_map = {item["member_id"]: item["net_balance"] for item in bals}
        assert bal_map[a] == 450.00
        assert bal_map[b] == 50.00
        assert bal_map[c] == -250.00
        assert bal_map[d] == -250.00

        # Check settlement suggestions
        suggs = (await client.get(f"/api/groups/{gid}/settlements")).json()
        assert len(suggs) <= 3
        assert sum(s["amount"] for s in suggs) == 500.00


@pytest.mark.asyncio
async def test_ec_multiple_payers_validation_rejections():
    """Verify backend rejects invalid multiple payers configurations."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Validation Group", "currency": "INR"})).json()["id"]
        a = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        b = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        # 1. Payer sum mismatch: 600 + 300 != 1000
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Mismatch",
                "amount": 1000.00,
                "payers": [
                    {"member_id": a, "amount": 600.00},
                    {"member_id": b, "amount": 300.00},
                ],
                "split_method": "EQUAL",
                "participants": [a, b],
            },
        )
        assert res.status_code == 400
        assert "must equal expense amount" in res.json()["detail"]

        # 2. Duplicate payer in payers list
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Duplicate Payer",
                "amount": 100.00,
                "payers": [
                    {"member_id": a, "amount": 50.00},
                    {"member_id": a, "amount": 50.00},
                ],
                "split_method": "EQUAL",
                "participants": [a, b],
            },
        )
        assert res.status_code == 400
        assert "Duplicate payer" in res.json()["detail"]

        # 3. Empty payers list
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "No Payers",
                "amount": 100.00,
                "payers": [],
                "split_method": "EQUAL",
                "participants": [a, b],
            },
        )
        assert res.status_code == 400
        assert "at least 1 item" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_ac_multiple_payers_exact_split_and_edit():
    """Verify multiple payers works with EXACT split and expense editing."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        gid = (await client.post("/api/groups", json={"name": "Exact Multi Group", "currency": "USD"})).json()["id"]
        a = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        b = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]
        c = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()["id"]

        # A paid 80, B paid 20, total 100.
        # Exact shares: Alice owes 30, Bob owes 30, Charlie owes 40.
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Dinner Exact",
                "amount": 100.00,
                "payers": [
                    {"member_id": a, "amount": 80.00},
                    {"member_id": b, "amount": 20.00},
                ],
                "split_method": "EXACT",
                "shares": [
                    {"member_id": a, "owed_amount": 30.00},
                    {"member_id": b, "owed_amount": 30.00},
                    {"member_id": c, "owed_amount": 40.00},
                ],
            },
        )
        assert res.status_code == 201
        exp_id = res.json()["id"]

        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        bal_map = {item["member_id"]: item["net_balance"] for item in bals}
        # Alice: 80 paid - 30 owed = +50
        # Bob: 20 paid - 30 owed = -10
        # Charlie: 0 paid - 40 owed = -40
        assert bal_map[a] == 50.00
        assert bal_map[b] == -10.00
        assert bal_map[c] == -40.00

        # Now edit the expense: total becomes 150 (A pays 100, B pays 50)
        # Exact shares: Alice owes 50, Bob owes 50, Charlie owes 50.
        edit_res = await client.put(
            f"/api/groups/{gid}/expenses/{exp_id}",
            json={
                "title": "Dinner Exact (Revised)",
                "amount": 150.00,
                "payers": [
                    {"member_id": a, "amount": 100.00},
                    {"member_id": b, "amount": 50.00},
                ],
                "split_method": "EXACT",
                "shares": [
                    {"member_id": a, "owed_amount": 50.00},
                    {"member_id": b, "owed_amount": 50.00},
                    {"member_id": c, "owed_amount": 50.00},
                ],
            },
        )
        assert edit_res.status_code == 200

        bals2 = (await client.get(f"/api/groups/{gid}/balances")).json()
        bal_map2 = {item["member_id"]: item["net_balance"] for item in bals2}
        # Alice: 100 - 50 = +50
        # Bob: 50 - 50 = 0.00
        # Charlie: 0 - 50 = -50
        assert bal_map2[a] == 50.00
        assert bal_map2[b] == 0.00
        assert bal_map2[c] == -50.00

