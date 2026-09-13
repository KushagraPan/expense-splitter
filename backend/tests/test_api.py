"""Integration tests for all FastAPI endpoints and domain validations.

Reference: Phase B requirements and openapi.yaml.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.store import store


@pytest.fixture(autouse=True)
def reset_in_memory_store():
    store.reset(seed=False)
    yield


@pytest.mark.asyncio
async def test_group_lifecycle():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create group
        res = await client.post("/api/groups", json={"name": "Trip to Paris", "currency": "EUR"})
        assert res.status_code == 201
        group = res.json()
        group_id = group["id"]
        assert group["name"] == "Trip to Paris"
        assert group["status"] == "ACTIVE"
        assert group["currency"] == "EUR"

        # Retrieve group
        res = await client.get(f"/api/groups/{group_id}")
        assert res.status_code == 200
        assert res.json()["id"] == group_id

        # List groups
        res = await client.get("/api/groups")
        assert res.status_code == 200
        assert len(res.json()) == 1

        # Archive empty group (balances are all 0)
        res = await client.post(f"/api/groups/{group_id}/archive")
        assert res.status_code == 200
        assert res.json()["status"] == "ARCHIVED"

        # Attempt to archive again -> 409 Conflict
        res = await client.post(f"/api/groups/{group_id}/archive")
        assert res.status_code == 409

        # Reopen group -> 200 OK
        res = await client.post(f"/api/groups/{group_id}/reopen")
        assert res.status_code == 200
        assert res.json()["status"] == "ACTIVE"

        # Attempt to reopen active group -> 400 Bad Request
        res = await client.post(f"/api/groups/{group_id}/reopen")
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_member_management():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Setup group
        g_res = await client.post("/api/groups", json={"name": "Team", "currency": "USD"})
        gid = g_res.json()["id"]

        # Add member Alice
        res = await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})
        assert res.status_code == 201
        m_alice = res.json()
        assert m_alice["name"] == "Alice"

        # Duplicate member (case-insensitive) -> 400
        res = await client.post(f"/api/groups/{gid}/members", json={"name": "alice"})
        assert res.status_code == 400
        assert "unique" in res.json()["detail"].lower()

        # Add member Bob
        res = await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})
        assert res.status_code == 201
        m_bob = res.json()

        # List members
        res = await client.get(f"/api/groups/{gid}/members")
        assert res.status_code == 200
        assert len(res.json()) == 2

        # Delete member with no history -> 204
        res = await client.delete(f"/api/groups/{gid}/members/{m_bob['id']}")
        assert res.status_code == 204

        # Verify deletion
        res = await client.get(f"/api/groups/{gid}/members")
        assert len(res.json()) == 1


@pytest.mark.asyncio
async def test_expenses_and_remainder_allocation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        g_res = await client.post("/api/groups", json={"name": "Outing", "currency": "INR"})
        gid = g_res.json()["id"]

        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]
        m3 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})).json()["id"]

        # 1. Create EQUAL expense (100 among 3: 33.34, 33.33, 33.33)
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Buffet",
                "amount": 100.00,
                "payer_id": m1,
                "split_method": "EQUAL",
                "participants": [m1, m2, m3],
            },
        )
        assert res.status_code == 201
        exp = res.json()
        assert len(exp["shares"]) == 3
        assert exp["shares"][0]["owed_amount"] == 33.34
        assert exp["shares"][1]["owed_amount"] == 33.33
        assert exp["shares"][2]["owed_amount"] == 33.33

        # 2. Payer excluded from participants
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Gift for Alice",
                "amount": 50.00,
                "payer_id": m1,
                "split_method": "EQUAL",
                "participants": [m2, m3],
            },
        )
        assert res.status_code == 201
        gift_exp = res.json()
        assert len(gift_exp["shares"]) == 2
        assert all(s["member_id"] != m1 for s in gift_exp["shares"])

        # 3. Create EXACT expense with mismatch -> 400
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Cab",
                "amount": 100.00,
                "payer_id": m1,
                "split_method": "EXACT",
                "shares": [
                    {"member_id": m2, "owed_amount": 40.00},
                    {"member_id": m3, "owed_amount": 50.00},  # sum is 90 != 100
                ],
            },
        )
        assert res.status_code == 400

        # 4. Create EXACT expense with matching sum -> 201
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Cab",
                "amount": 100.00,
                "payer_id": m1,
                "split_method": "EXACT",
                "shares": [
                    {"member_id": m2, "owed_amount": 40.00},
                    {"member_id": m3, "owed_amount": 60.00},
                ],
            },
        )
        assert res.status_code == 201
        exact_exp = res.json()
        eid = exact_exp["id"]

        # Update expense (PUT)
        res = await client.put(
            f"/api/groups/{gid}/expenses/{eid}",
            json={
                "title": "Cab (Updated)",
                "amount": 100.00,
                "payer_id": m1,
                "split_method": "EXACT",
                "shares": [
                    {"member_id": m2, "owed_amount": 50.00},
                    {"member_id": m3, "owed_amount": 50.00},
                ],
            },
        )
        assert res.status_code == 200
        assert res.json()["title"] == "Cab (Updated)"

        # Delete expense
        res = await client.delete(f"/api/groups/{gid}/expenses/{eid}")
        assert res.status_code == 204


@pytest.mark.asyncio
async def test_balances_and_settlements_and_payments():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        g_res = await client.post("/api/groups", json={"name": "Goa Trip", "currency": "INR"})
        gid = g_res.json()["id"]

        m_alice = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m_bob = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        # Alice pays 100, Bob owes 100
        await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Hotel Room",
                "amount": 100.00,
                "payer_id": m_alice,
                "split_method": "EXACT",
                "shares": [{"member_id": m_bob, "owed_amount": 100.00}],
            },
        )

        # 1. Net Balances check
        res = await client.get(f"/api/groups/{gid}/balances")
        assert res.status_code == 200
        bals = res.json()
        alice_b = next(b for b in bals if b["member_id"] == m_alice)
        bob_b = next(b for b in bals if b["member_id"] == m_bob)
        assert alice_b["net_balance"] == 100.00
        assert bob_b["net_balance"] == -100.00
        # Zero-sum invariant
        assert sum(round(b["net_balance"] * 100) for b in bals) == 0

        # Cannot archive with non-zero balances
        res = await client.post(f"/api/groups/{gid}/archive")
        assert res.status_code == 400

        # Cannot delete Bob while financial history exists
        res = await client.delete(f"/api/groups/{gid}/members/{m_bob}")
        assert res.status_code == 400

        # 2. Settlement suggestions check
        res = await client.get(f"/api/groups/{gid}/settlements")
        assert res.status_code == 200
        suggs = res.json()
        assert len(suggs) == 1
        assert suggs[0]["payer_id"] == m_bob
        assert suggs[0]["recipient_id"] == m_alice
        assert suggs[0]["amount"] == 100.00

        # 3. Payments Validation:
        # Zero payment rejected
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_bob, "recipient_id": m_alice, "amount": 0},
        )
        assert res.status_code == 400

        # Negative payment rejected
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_bob, "recipient_id": m_alice, "amount": -10},
        )
        assert res.status_code == 400

        # Payer == Recipient rejected
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_bob, "recipient_id": m_bob, "amount": 50},
        )
        assert res.status_code == 400

        # Non-creditor payment rejected (Alice paying Bob when Bob owes Alice)
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_alice, "recipient_id": m_bob, "amount": 50},
        )
        assert res.status_code == 400

        # Overpayment rejected (100.01 > 100.00)
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_bob, "recipient_id": m_alice, "amount": 100.01},
        )
        assert res.status_code == 400

        # 4. Partial Payment (40.00)
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_bob, "recipient_id": m_alice, "amount": 40.00, "notes": "UPI transfer"},
        )
        assert res.status_code == 201
        p = res.json()
        assert p["amount"] == 40.00

        # Check balances after partial payment
        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        assert next(b for b in bals if b["member_id"] == m_alice)["net_balance"] == 60.00
        assert next(b for b in bals if b["member_id"] == m_bob)["net_balance"] == -60.00

        # Check suggestion decreased to 60.00
        suggs = (await client.get(f"/api/groups/{gid}/settlements")).json()
        assert len(suggs) == 1
        assert suggs[0]["amount"] == 60.00

        # Member deletion still blocked due to payment history
        res = await client.delete(f"/api/groups/{gid}/members/{m_bob}")
        assert res.status_code == 400

        # 5. Full remaining payment (60.00)
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_bob, "recipient_id": m_alice, "amount": 60.00},
        )
        assert res.status_code == 201

        # Check balances are 0
        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        assert all(b["net_balance"] == 0.00 for b in bals)

        # Check suggestions are empty
        suggs = (await client.get(f"/api/groups/{gid}/settlements")).json()
        assert len(suggs) == 0

        # List payments
        payments = (await client.get(f"/api/groups/{gid}/payments")).json()
        assert len(payments) == 2

        # 6. Archive group now succeeds
        res = await client.post(f"/api/groups/{gid}/archive")
        assert res.status_code == 200
        assert res.json()["status"] == "ARCHIVED"

        # Archived group blocks new payments -> 403
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_bob, "recipient_id": m_alice, "amount": 10.00},
        )
        assert res.status_code == 403

        # Archived group blocks new expenses -> 403
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Snacks",
                "amount": 20.00,
                "payer_id": m_alice,
                "split_method": "EQUAL",
                "participants": [m_alice, m_bob],
            },
        )
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_debt_inversion_api_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        g_res = await client.post("/api/groups", json={"name": "Inversion Test", "currency": "INR"})
        gid = g_res.json()["id"]

        m_alice = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m_bob = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        # Expense: Bob owes Alice 100
        exp = (
            await client.post(
                f"/api/groups/{gid}/expenses",
                json={
                    "title": "Train",
                    "amount": 100.00,
                    "payer_id": m_alice,
                    "split_method": "EXACT",
                    "shares": [{"member_id": m_bob, "owed_amount": 100.00}],
                },
            )
        ).json()

        # Bob pays 60
        await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_bob, "recipient_id": m_alice, "amount": 60.00},
        )

        # Delete expense entirely -> Debt Inversion!
        res = await client.delete(f"/api/groups/{gid}/expenses/{exp['id']}")
        assert res.status_code == 204

        # Bob should now be creditor (+60), Alice should be debtor (-60)
        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        assert next(b for b in bals if b["member_id"] == m_bob)["net_balance"] == 60.00
        assert next(b for b in bals if b["member_id"] == m_alice)["net_balance"] == -60.00

        # Suggested refund: Alice pays Bob 60.00!
        suggs = (await client.get(f"/api/groups/{gid}/settlements")).json()
        assert len(suggs) == 1
        assert suggs[0]["payer_id"] == m_alice
        assert suggs[0]["recipient_id"] == m_bob
        assert suggs[0]["amount"] == 60.00

        # Alice records refund payment
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m_alice, "recipient_id": m_bob, "amount": 60.00, "notes": "Refund"},
        )
        assert res.status_code == 201

        # All settled
        bals = (await client.get(f"/api/groups/{gid}/balances")).json()
        assert all(b["net_balance"] == 0.00 for b in bals)
