"""Comprehensive edge case and HTTP status code validation tests for FastAPI backend."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.store import store


@pytest.fixture(autouse=True)
def reset_db():
    store.reset(seed=False)
    yield


@pytest.mark.asyncio
async def test_group_error_cases():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Non-existent group -> 404
        res = await client.get("/api/groups/grp-does-not-exist")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

        # Empty group name -> 400
        res = await client.post("/api/groups", json={"name": "   ", "currency": "USD"})
        assert res.status_code == 400
        assert "name cannot be empty" in res.json()["detail"].lower()

        # Create valid group
        res = await client.post("/api/groups", json={"name": "Valid Group", "currency": "EUR"})
        assert res.status_code == 201
        gid = res.json()["id"]

        # Reopening active group -> 400
        res = await client.post(f"/api/groups/{gid}/reopen")
        assert res.status_code == 400

        # Archive active group with zero balances -> 200
        res = await client.post(f"/api/groups/{gid}/archive")
        assert res.status_code == 200
        assert res.json()["status"] == "ARCHIVED"

        # Archiving already archived group -> 409
        res = await client.post(f"/api/groups/{gid}/archive")
        assert res.status_code == 409


@pytest.mark.asyncio
async def test_member_error_cases():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Group setup
        g_res = await client.post("/api/groups", json={"name": "Member Test", "currency": "USD"})
        gid = g_res.json()["id"]

        # Empty member name -> 400
        res = await client.post(f"/api/groups/{gid}/members", json={"name": "   "})
        assert res.status_code == 400
        assert "name cannot be empty" in res.json()["detail"].lower()

        # Non-existent member deletion -> 404
        res = await client.delete(f"/api/groups/{gid}/members/mem-does-not-exist")
        assert res.status_code == 404

        # Add member Alice
        await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})

        # Duplicate member (case-insensitive) -> 400
        res = await client.post(f"/api/groups/{gid}/members", json={"name": "alice"})
        assert res.status_code == 400

        # Adding member to non-existent group -> 404
        res = await client.post("/api/groups/grp-phantom/members", json={"name": "Ghost"})
        assert res.status_code == 404

        # Listing members of non-existent group -> 404
        res = await client.get("/api/groups/grp-phantom/members")
        assert res.status_code == 404


@pytest.mark.asyncio
async def test_expense_error_cases():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        g_res = await client.post("/api/groups", json={"name": "Expense Test", "currency": "USD"})
        gid = g_res.json()["id"]

        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        # Non-existent expense retrieval -> 404
        res = await client.get(f"/api/groups/{gid}/expenses/exp-none")
        assert res.status_code == 404

        # Non-existent expense update -> 404
        res = await client.put(
            f"/api/groups/{gid}/expenses/exp-none",
            json={
                "title": "New Title",
                "amount": 20.00,
                "payers": [{"member_id": m1, "amount": 20.00}],
                "split_method": "EQUAL",
                "participants": [m1, m2],
            },
        )
        assert res.status_code == 404

        # Non-existent expense deletion -> 404
        res = await client.delete(f"/api/groups/{gid}/expenses/exp-none")
        assert res.status_code == 404

        # Empty expense title -> 400
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "   ",
                "amount": 50.00,
                "payers": [{"member_id": m1, "amount": 50.00}],
                "split_method": "EQUAL",
                "participants": [m1, m2],
            },
        )
        assert res.status_code == 400

        # Zero or negative amount -> 400
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Zero Expense",
                "amount": 0.00,
                "payers": [{"member_id": m1, "amount": 0.00}],
                "split_method": "EQUAL",
                "participants": [m1, m2],
            },
        )
        assert res.status_code == 400

        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Negative Expense",
                "amount": -10.00,
                "payers": [{"member_id": m1, "amount": -10.00}],
                "split_method": "EQUAL",
                "participants": [m1, m2],
            },
        )
        assert res.status_code == 400

        # Payer not in group -> 400
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Outsider",
                "amount": 30.00,
                "payers": [{"member_id": "mem-stranger", "amount": 30.00}],
                "split_method": "EQUAL",
                "participants": [m1, m2],
            },
        )
        assert res.status_code == 400

        # Participant not in group -> 400
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Outsider Part",
                "amount": 30.00,
                "payers": [{"member_id": m1, "amount": 30.00}],
                "split_method": "EQUAL",
                "participants": [m1, "mem-stranger"],
            },
        )
        assert res.status_code == 400

        # Empty participants list -> 400
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Nobody",
                "amount": 30.00,
                "payers": [{"member_id": m1, "amount": 30.00}],
                "split_method": "EQUAL",
                "participants": [],
            },
        )
        assert res.status_code == 400

        # EXACT split negative share -> 400
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Negative Share",
                "amount": 20.00,
                "payers": [{"member_id": m1, "amount": 20.00}],
                "split_method": "EXACT",
                "shares": [
                    {"member_id": m1, "owed_amount": 30.00},
                    {"member_id": m2, "owed_amount": -10.00},
                ],
            },
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_archived_group_immutability():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        g_res = await client.post("/api/groups", json={"name": "Archive Lock Test", "currency": "USD"})
        gid = g_res.json()["id"]

        m1 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Alice"})).json()["id"]
        m2 = (await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})).json()["id"]

        # Create expense and settle it completely so we can archive
        await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Lunch",
                "amount": 40.00,
                "payers": [{"member_id": m1, "amount": 40.00}],
                "split_method": "EXACT",
                "shares": [{"member_id": m2, "owed_amount": 40.00}],
            },
        )
        # Settle
        await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m2, "recipient_id": m1, "amount": 40.00},
        )

        # Archive group
        res = await client.post(f"/api/groups/{gid}/archive")
        assert res.status_code == 200

        # Mutations against archived group must return 403 Forbidden:
        # 1. Add member -> 403
        res = await client.post(f"/api/groups/{gid}/members", json={"name": "Charlie"})
        assert res.status_code == 403

        # 2. Add expense -> 403
        res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Coffee",
                "amount": 5.00,
                "payers": [{"member_id": m1, "amount": 5.00}],
                "split_method": "EQUAL",
                "participants": [m1],
            },
        )
        assert res.status_code == 403

        # 3. Add payment -> 403
        res = await client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m2, "recipient_id": m1, "amount": 5.00},
        )
        assert res.status_code == 403

        # Reads must still succeed:
        assert (await client.get(f"/api/groups/{gid}")).status_code == 200
        assert (await client.get(f"/api/groups/{gid}/members")).status_code == 200
        assert (await client.get(f"/api/groups/{gid}/expenses")).status_code == 200
        assert (await client.get(f"/api/groups/{gid}/payments")).status_code == 200
        assert (await client.get(f"/api/groups/{gid}/balances")).status_code == 200
        assert (await client.get(f"/api/groups/{gid}/settlements")).status_code == 200


@pytest.mark.asyncio
async def test_zero_history_rule_all_scenarios():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        g_res = await client.post("/api/groups", json={"name": "History Test", "currency": "INR"})
        gid = g_res.json()["id"]

        m_payer = (await client.post(f"/api/groups/{gid}/members", json={"name": "Payer"})).json()["id"]
        m_part = (await client.post(f"/api/groups/{gid}/members", json={"name": "Participant"})).json()["id"]
        m_free = (await client.post(f"/api/groups/{gid}/members", json={"name": "FreeMember"})).json()["id"]

        # Create expense where Payer pays, Participant shares
        exp_res = await client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Movie",
                "amount": 200.00,
                "payers": [{"member_id": m_payer, "amount": 200.00}],
                "split_method": "EXACT",
                "shares": [{"member_id": m_part, "owed_amount": 200.00}],
            },
        )
        exp_id = exp_res.json()["id"]

        # Payer cannot be deleted (400)
        res = await client.delete(f"/api/groups/{gid}/members/{m_payer}")
        assert res.status_code == 400

        # Participant cannot be deleted (400)
        res = await client.delete(f"/api/groups/{gid}/members/{m_part}")
        assert res.status_code == 400

        # Free member can be deleted (204)
        res = await client.delete(f"/api/groups/{gid}/members/{m_free}")
        assert res.status_code == 204

        # Delete the expense
        await client.delete(f"/api/groups/{gid}/expenses/{exp_id}")

        # Now both Payer and Participant have no financial history and can be deleted
        res = await client.delete(f"/api/groups/{gid}/members/{m_part}")
        assert res.status_code == 204
        res = await client.delete(f"/api/groups/{gid}/members/{m_payer}")
        assert res.status_code == 204


@pytest.mark.asyncio
async def test_pydantic_schema_validation_error_format():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Send invalid payload (missing required field 'name')
        res = await client.post("/api/groups", json={"currency": "USD"})
        assert res.status_code == 400
        body = res.json()
        assert "detail" in body
