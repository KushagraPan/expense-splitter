import httpx

client = httpx.Client(base_url="http://127.0.0.1:8000/api", timeout=10.0)

groups = client.get("/groups").json()
print(f"Total groups: {len(groups)}")
for g in groups:
    print(f" - {g['name']} ({g['currency']}) | Status: {g['status']}")

print("\n=== DETAILED GROUP VERIFICATION ===")

for g in groups:
    gid = g["id"]
    name = g["name"]
    curr = g["currency"]
    status = g["status"]
    print(f"\n========================================================")
    print(f"GROUP: {name} ({curr}) [Status: {status}] [ID: {gid}]")
    print(f"========================================================")

    members = client.get(f"/groups/{gid}/members").json()
    member_names = [m["name"] for m in members]
    print(f"Members ({len(members)}): {', '.join(member_names)}")

    expenses = client.get(f"/groups/{gid}/expenses").json()
    total_spend = sum(e["amount"] for e in expenses)
    print(f"Expenses ({len(expenses)}) | Total Spend: {curr} {total_spend:,.2f}")

    for e in expenses:
        payer_sum = sum(p["amount"] for p in e.get("payers", []))
        diff_p = abs(payer_sum - e["amount"])
        assert diff_p < 0.005, f"Payer sum mismatch on {e['title']}: {payer_sum} vs {e['amount']}"

        if e["split_method"] == "EXACT":
            share_sum = sum(s["owed_amount"] for s in e.get("shares", []))
            diff_s = abs(share_sum - e["amount"])
            assert diff_s < 0.005, f"Share sum mismatch on {e['title']}: {share_sum} vs {e['amount']}"
            print(f"  • [EXACT] {e['title']} ({e.get('category') or 'None'}): {curr} {e['amount']:,.2f} | Payers: {len(e.get('payers', []))}, Participants: {len(e.get('shares', []))}")
        else:
            print(f"  • [EQUAL] {e['title']} ({e.get('category') or 'None'}): {curr} {e['amount']:,.2f} | Payers: {len(e.get('payers', []))}, Participants: {len(e.get('shares', []))}")

    balances = client.get(f"/groups/{gid}/balances").json()
    print(f"\nBalances ({len(balances)}):")
    net_sum = 0.0
    for b in balances:
        net_sum += b["net_balance"]
        paid = b.get("paid_amount", 0.0) or 0.0
        owed = b.get("owed_amount", 0.0) or 0.0
        print(f"  • {b['member_name']}: Net = {curr} {b['net_balance']:+,.2f} (Paid: {paid:,.2f}, Owed: {owed:,.2f})")
    assert abs(net_sum) < 0.005, f"Sum of net balances must be zero, got {net_sum}"

    settlements = client.get(f"/groups/{gid}/settlements").json()
    print(f"\nSettlement suggestions ({len(settlements)}):")
    for s in settlements:
        print(f"  • {s['payer_name']} pays {s['recipient_name']}: {curr} {s['amount']:,.2f}")

    payments = client.get(f"/groups/{gid}/payments").json()
    print(f"\nPayment history ({len(payments)}):")
    for p in payments:
        notes_str = f" - '{p['notes']}'" if p.get("notes") else ""
        print(f"  • {p['payment_date']}: {curr} {p['amount']:,.2f}{notes_str}")

print("\n>>> ALL CHECKS PASSED PERFECTLY! <<<")
