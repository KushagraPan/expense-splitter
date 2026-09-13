"""Mandatory Restart / Persistence Verification Script.

Launches a live FastAPI uvicorn server against an isolated SQLite database,
writes transactions over HTTP, terminates the server process, restarts a new
server process against the same database file, and verifies all data, balances,
and lifecycle operations persist accurately.
"""

import os
import subprocess
import sys
import time

import httpx

PORT = 8005
BASE_URL = f"http://127.0.0.1:{PORT}"
DB_FILE = os.path.abspath("restart_persistence_test.db")
DB_URL = f"sqlite:///{DB_FILE}"


def wait_for_server(timeout_sec: float = 15.0) -> bool:
    start = time.time()
    while time.time() - start < timeout_sec:
        try:
            r = httpx.get(f"{BASE_URL}/health", timeout=1.0)
            if r.status_code == 200:
                return True
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    return False


def start_server() -> subprocess.Popen:
    env = os.environ.copy()
    env["EXPENSE_SPLITTER_DATABASE_URL"] = DB_URL
    env["EXPENSE_SPLITTER_PORT"] = str(PORT)
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(PORT), "--host", "127.0.0.1"],
        cwd=os.path.abspath("."),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return proc


def stop_server(proc: subprocess.Popen) -> None:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()


def run_verification() -> None:
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)

    print("======================================================================")
    print("PHASE 1: Starting First Server Process (Process A)")
    print(f"Database URL: {DB_URL}")
    print("======================================================================")
    p1 = start_server()
    assert wait_for_server(), "Server Process A failed to start!"
    print("Server Process A is healthy on", BASE_URL)

    with httpx.Client(base_url=BASE_URL, timeout=5.0) as client:
        # 1. Create Group
        r = client.post("/api/groups", json={"name": "Persistent Roadtrip", "currency": "EUR"})
        assert r.status_code == 201, f"Failed create group: {r.text}"
        group = r.json()
        gid = group["id"]
        print(f"[OK] Created group: id={gid}, name='{group['name']}', currency='{group['currency']}'")

        # 2. Add Members
        r_m1 = client.post(f"/api/groups/{gid}/members", json={"name": "Marco"})
        assert r_m1.status_code == 201
        m1_id = r_m1.json()["id"]

        r_m2 = client.post(f"/api/groups/{gid}/members", json={"name": "Polo"})
        assert r_m2.status_code == 201
        m2_id = r_m2.json()["id"]
        print(f"[OK] Added members: Marco ({m1_id}), Polo ({m2_id})")

        # 3. Create Expense (Marco pays 90.00 EUR for Marco & Polo)
        r_exp = client.post(
            f"/api/groups/{gid}/expenses",
            json={
                "title": "Tolls & Fuel",
                "amount": 90.00,
                "payer_id": m1_id,
                "split_method": "EQUAL",
                "participants": [m1_id, m2_id],
                "category": "Transport",
                "notes": "Highway toll passes",
            },
        )
        assert r_exp.status_code == 201
        exp_id = r_exp.json()["id"]
        print(f"[OK] Created expense: id={exp_id}, amount=90.00 EUR, payer=Marco")

        # 4. Partial Payment (Polo pays Marco 20.00 EUR)
        r_pay = client.post(
            f"/api/groups/{gid}/payments",
            json={
                "payer_id": m2_id,
                "recipient_id": m1_id,
                "amount": 20.00,
                "notes": "Partial cash payment",
            },
        )
        assert r_pay.status_code == 201
        pay_id = r_pay.json()["id"]
        print(f"[OK] Recorded partial payment: id={pay_id}, amount=20.00 EUR (Polo -> Marco)")

        # Verify net balances pre-restart
        bals = client.get(f"/api/groups/{gid}/balances").json()
        marco_bal = next(b for b in bals if b["member_id"] == m1_id)["net_balance"]
        polo_bal = next(b for b in bals if b["member_id"] == m2_id)["net_balance"]
        print(f"[OK] Pre-restart balances: Marco = +{marco_bal} EUR, Polo = {polo_bal} EUR")
        assert marco_bal == 25.00
        assert polo_bal == -25.00

    print("\n======================================================================")
    print("PHASE 2: Terminating Server Process A (Simulating Full Process Death)")
    print("======================================================================")
    stop_server(p1)
    time.sleep(1)
    print("Server Process A has been completely stopped.")

    # Confirm port is offline
    try:
        httpx.get(f"{BASE_URL}/health", timeout=1.0)
        assert False, "Server should be offline!"
    except httpx.HTTPError:
        print("Confirmed: Server is completely unreachable.")

    print("\n======================================================================")
    print("PHASE 3: Starting Second Server Process (Process B) On Same Database")
    print("======================================================================")
    p2 = start_server()
    assert wait_for_server(), "Server Process B failed to start!"
    print("Server Process B is healthy on", BASE_URL)

    with httpx.Client(base_url=BASE_URL, timeout=5.0) as client:
        # Verify Group survived
        r_grp = client.get(f"/api/groups/{gid}")
        assert r_grp.status_code == 200
        g_loaded = r_grp.json()
        assert g_loaded["name"] == "Persistent Roadtrip"
        assert g_loaded["status"] == "ACTIVE"
        print(f"[OK] Verified group survived restart: name='{g_loaded['name']}', status={g_loaded['status']}")

        # Verify Members survived
        members = client.get(f"/api/groups/{gid}/members").json()
        assert len(members) == 2
        member_names = {m["name"] for m in members}
        assert member_names == {"Marco", "Polo"}
        print(f"[OK] Verified members survived restart: {member_names}")

        # Verify Expense survived
        expenses = client.get(f"/api/groups/{gid}/expenses").json()
        assert len(expenses) == 1
        assert expenses[0]["id"] == exp_id
        assert expenses[0]["amount"] == 90.00
        assert expenses[0]["category"] == "Transport"
        print(f"[OK] Verified expense survived restart: '{expenses[0]['title']}', amount={expenses[0]['amount']}")

        # Verify Payment survived
        payments = client.get(f"/api/groups/{gid}/payments").json()
        assert len(payments) == 1
        assert payments[0]["id"] == pay_id
        assert payments[0]["amount"] == 20.00
        print(f"[OK] Verified payment survived restart: amount={payments[0]['amount']}")

        # Verify Dynamic Net Balances accurately recomputed from persisted records
        bals = client.get(f"/api/groups/{gid}/balances").json()
        marco_bal = next(b for b in bals if b["member_id"] == m1_id)["net_balance"]
        polo_bal = next(b for b in bals if b["member_id"] == m2_id)["net_balance"]
        assert marco_bal == 25.00
        assert polo_bal == -25.00
        print(f"[OK] Verified recomputed net balances on fresh server: Marco = +{marco_bal} EUR, Polo = {polo_bal} EUR")

        # Verify Settlement Suggestions on fresh server
        suggs = client.get(f"/api/groups/{gid}/settlements").json()
        assert len(suggs) == 1
        assert suggs[0]["payer_id"] == m2_id
        assert suggs[0]["recipient_id"] == m1_id
        assert suggs[0]["amount"] == 25.00
        print(f"[OK] Verified settlement suggestion: Polo pays Marco {suggs[0]['amount']} EUR")

        # Settle remainder
        r_final_pay = client.post(
            f"/api/groups/{gid}/payments",
            json={"payer_id": m2_id, "recipient_id": m1_id, "amount": 25.00},
        )
        assert r_final_pay.status_code == 201
        print("[OK] Recorded final settlement payment: 25.00 EUR")

        # Archive group on fresh server
        r_arch = client.post(f"/api/groups/{gid}/archive")
        assert r_arch.status_code == 200
        assert r_arch.json()["status"] == "ARCHIVED"
        print("[OK] Successfully archived group on restarted server!")

    stop_server(p2)
    print("\n======================================================================")
    print("ALL PERSISTENCE AND RESTART TESTS PASSED SUCCESSFULLY!")
    print("======================================================================")

    if os.path.exists(DB_FILE):
        try:
            os.remove(DB_FILE)
        except OSError:
            pass


if __name__ == "__main__":
    run_verification()
