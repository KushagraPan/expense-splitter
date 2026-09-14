"""Idempotent seed script to generate 4 professional demo groups for Expense Splitter.

Currencies used (exactly the 4 supported currencies):
1. INR (₹) — Goa Weekend Getaway (5 members, 9 expenses)
2. USD ($) — Pacific Coast Highway Trip (4 members, 9 expenses)
3. EUR (€) — Berlin Innovation Summit (4 members, 9 expenses, 2 payments, partial settlement)
4. GBP (£) — Cotswolds Walking Retreat (4 members, 8 expenses, 3 payments, fully settled & archived)
"""

import sys
import httpx

BASE_URL = "http://127.0.0.1:8000/api"


def seed():
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # 1. Fetch existing groups to ensure idempotency
    res = client.get("/groups")
    res.raise_for_status()
    existing_groups = res.json()
    existing_names = {g["name"]: g for g in existing_groups}

    print(f"Found {len(existing_groups)} existing groups in database.")

    # =========================================================================
    # GROUP 1: INR (₹) — Goa Weekend Getaway
    # =========================================================================
    g1_name = "Goa Weekend Getaway"
    if g1_name in existing_names:
        print(f"[SKIP] Group '{g1_name}' already exists.")
    else:
        print(f"[CREATE] Creating Group 1: '{g1_name}' (INR)...")
        r = client.post("/groups", json={"name": g1_name, "currency": "INR"})
        r.raise_for_status()
        g1 = r.json()
        g1_id = g1["id"]

        # 5 culturally appropriate members
        members_data = ["Aarav Sharma", "Priya Patel", "Rohan Mehta", "Ananya Iyer", "Kabir Verma"]
        m_map = {}
        for m_name in members_data:
            r = client.post(f"/groups/{g1_id}/members", json={"name": m_name})
            r.raise_for_status()
            m = r.json()
            m_map[m_name] = m["id"]

        aarav = m_map["Aarav Sharma"]
        priya = m_map["Priya Patel"]
        rohan = m_map["Rohan Mehta"]
        ananya = m_map["Ananya Iyer"]
        kabir = m_map["Kabir Verma"]
        all_5 = [aarav, priya, rohan, ananya, kabir]

        # 9 realistic expenses
        expenses_g1 = [
            {
                "title": "Candolim Beach Villa Booking (3 Nights)",
                "amount": 45000.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": aarav, "amount": 45000.00}],
                "participants": all_5,
                "category": "Accommodation",
                "notes": "Heritage Portuguese villa with private pool",
                "expense_date": "2026-09-04",
            },
            {
                "title": "Airport Innova Cabs to Villa",
                "amount": 4200.00,
                "split_method": "EQUAL",
                "payers": [
                    {"member_id": rohan, "amount": 2500.00},
                    {"member_id": kabir, "amount": 1700.00},
                ],
                "participants": all_5,
                "category": "Travel",
                "notes": "Two Innova taxis from Dabolim airport with toll receipts",
                "expense_date": "2026-09-04",
            },
            {
                "title": "Villa Pantry & Refreshments Supermarket Run",
                "amount": 6850.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": priya, "amount": 6850.00}],
                "participants": all_5,
                "category": "Groceries",
                "notes": "Beverages, snacks, breakfast provisions, and bottled water",
                "expense_date": "2026-09-04",
            },
            {
                "title": "Seafood Dinner at Fisherman's Wharf",
                "amount": 8920.00,
                "split_method": "EXACT",
                "payers": [{"member_id": rohan, "amount": 8920.00}],
                "participants": [aarav, priya, rohan, kabir],
                "shares": [
                    {"member_id": aarav, "owed_amount": 2400.00},
                    {"member_id": priya, "owed_amount": 1820.00},
                    {"member_id": rohan, "owed_amount": 2100.00},
                    {"member_id": kabir, "owed_amount": 2600.00},
                ],
                "category": "Restaurants",
                "notes": "Tiger prawns, butter garlic squid, and local curries (Ananya rested at villa)",
                "expense_date": "2026-09-04",
            },
            {
                "title": "Scuba Diving & Watersports at Grand Island",
                "amount": 14000.00,
                "split_method": "EQUAL",
                "payers": [
                    {"member_id": kabir, "amount": 9000.00},
                    {"member_id": aarav, "amount": 5000.00},
                ],
                "participants": [aarav, rohan, ananya, kabir],
                "category": "Activities",
                "notes": "Boat transfer, equipment rental, and instructor fees (Priya opted out)",
                "expense_date": "2026-09-05",
            },
            {
                "title": "Activa & Royal Enfield Scooter Rentals (3 Days)",
                "amount": 3600.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": ananya, "amount": 3600.00}],
                "participants": all_5,
                "category": "Local Transport",
                "notes": "3 Honda Activas and 1 Royal Enfield for North Goa exploring",
                "expense_date": "2026-09-05",
            },
            {
                "title": "Lunch & Refreshments at Curlies Beach Shack",
                "amount": 5430.00,
                "split_method": "EXACT",
                "payers": [{"member_id": priya, "amount": 5430.00}],
                "participants": all_5,
                "shares": [
                    {"member_id": aarav, "owed_amount": 1250.00},
                    {"member_id": priya, "owed_amount": 950.00},
                    {"member_id": rohan, "owed_amount": 1380.00},
                    {"member_id": ananya, "owed_amount": 850.00},
                    {"member_id": kabir, "owed_amount": 1000.00},
                ],
                "category": "Restaurants",
                "notes": "Beach shack lunch and coconut water in Anjuna",
                "expense_date": "2026-09-05",
            },
            {
                "title": "Mandovi River Sunset Cruise Tickets",
                "amount": 4500.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": ananya, "amount": 4500.00}],
                "participants": all_5,
                "category": "Activities",
                "notes": "Catamaran sunset sailing on Mandovi river with folk music",
                "expense_date": "2026-09-06",
            },
            {
                "title": "Return Airport Cabs & Express Highway Tolls",
                "amount": 4400.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": kabir, "amount": 4400.00}],
                "participants": all_5,
                "category": "Travel",
                "notes": "Return transport to airport with luggage surcharge",
                "expense_date": "2026-09-06",
            },
        ]

        for exp in expenses_g1:
            r = client.post(f"/groups/{g1_id}/expenses", json=exp)
            r.raise_for_status()

        print(f"  -> Added {len(expenses_g1)} expenses to '{g1_name}'. Outstanding debts preserved.")

    # =========================================================================
    # GROUP 2: USD ($) — Pacific Coast Highway Trip
    # =========================================================================
    g2_name = "Pacific Coast Highway Trip"
    if g2_name in existing_names:
        print(f"[SKIP] Group '{g2_name}' already exists.")
    else:
        print(f"[CREATE] Creating Group 2: '{g2_name}' (USD)...")
        r = client.post("/groups", json={"name": g2_name, "currency": "USD"})
        r.raise_for_status()
        g2 = r.json()
        g2_id = g2["id"]

        # 4 culturally appropriate members
        members_data = ["Marcus Vance", "Chloe Bennett", "Devon Reed", "Maya Lin"]
        m_map = {}
        for m_name in members_data:
            r = client.post(f"/groups/{g2_id}/members", json={"name": m_name})
            r.raise_for_status()
            m = r.json()
            m_map[m_name] = m["id"]

        marcus = m_map["Marcus Vance"]
        chloe = m_map["Chloe Bennett"]
        devon = m_map["Devon Reed"]
        maya = m_map["Maya Lin"]
        all_4 = [marcus, chloe, devon, maya]

        # 9 realistic expenses
        expenses_g2 = [
            {
                "title": "Big Sur Oceanview Cabin (2 Nights)",
                "amount": 980.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": marcus, "amount": 980.00}],
                "participants": all_4,
                "category": "Accommodation",
                "notes": "Timber cabin perched over Pacific cliffs near Lucia",
                "expense_date": "2026-08-14",
            },
            {
                "title": "7-Seater SUV Rental & Golden Gate Bridge Tolls",
                "amount": 480.00,
                "split_method": "EQUAL",
                "payers": [
                    {"member_id": devon, "amount": 300.00},
                    {"member_id": chloe, "amount": 180.00},
                ],
                "participants": all_4,
                "category": "Transport",
                "notes": "Avis SUV rental from SFO with full insurance coverage",
                "expense_date": "2026-08-14",
            },
            {
                "title": "Trader Joe's Roadtrip Provisions & Ice",
                "amount": 184.60,
                "split_method": "EQUAL",
                "payers": [{"member_id": chloe, "amount": 184.60}],
                "participants": all_4,
                "category": "Shopping",
                "notes": "Artisan sourdough, trail mix, fruit, dips, and cooler ice",
                "expense_date": "2026-08-14",
            },
            {
                "title": "Point Lobos State Reserve Passes & Wildlife Tour",
                "amount": 160.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": maya, "amount": 160.00}],
                "participants": [marcus, chloe, maya],
                "category": "Activities",
                "notes": "Entry fees and guided coastal tidepool walk (Devon stayed in town)",
                "expense_date": "2026-08-15",
            },
            {
                "title": "Seafood Dinner at Nepenthe Big Sur",
                "amount": 342.50,
                "split_method": "EXACT",
                "payers": [{"member_id": devon, "amount": 342.50}],
                "participants": all_4,
                "shares": [
                    {"member_id": marcus, "owed_amount": 95.50},
                    {"member_id": chloe, "owed_amount": 78.00},
                    {"member_id": devon, "owed_amount": 102.00},
                    {"member_id": maya, "owed_amount": 67.00},
                ],
                "category": "Restaurants",
                "notes": "Ambrosia burgers, local halibut, and sunset appetizers overlooking coast",
                "expense_date": "2026-08-15",
            },
            {
                "title": "Carmel Valley Wine Tasting Flights",
                "amount": 210.00,
                "split_method": "EXACT",
                "payers": [{"member_id": chloe, "amount": 210.00}],
                "participants": [chloe, devon, maya],
                "shares": [
                    {"member_id": chloe, "owed_amount": 70.00},
                    {"member_id": devon, "owed_amount": 70.00},
                    {"member_id": maya, "owed_amount": 70.00},
                ],
                "category": "Activities",
                "notes": "Pinot Noir reserve tasting (Marcus was designated driver)",
                "expense_date": "2026-08-16",
            },
            {
                "title": "Gasoline Refills along Highway 1",
                "amount": 128.40,
                "split_method": "EQUAL",
                "payers": [
                    {"member_id": marcus, "amount": 68.40},
                    {"member_id": devon, "amount": 60.00},
                ],
                "participants": all_4,
                "category": "Transport",
                "notes": "Chevron fill-ups in Monterey and San Simeon",
                "expense_date": "2026-08-16",
            },
            {
                "title": "Artisan Bakery Breakfast & Specialty Coffees",
                "amount": 76.80,
                "split_method": "EQUAL",
                "payers": [{"member_id": maya, "amount": 76.80}],
                "participants": all_4,
                "category": "Restaurants",
                "notes": "Cardamom buns, avocado toasts, and cortados in Carmel-by-the-Sea",
                "expense_date": "2026-08-16",
            },
            {
                "title": "Souvenirs & Highway 1 Map Prints",
                "amount": 95.00,
                "split_method": "EXACT",
                "payers": [{"member_id": marcus, "amount": 95.00}],
                "participants": [marcus, chloe, maya],
                "shares": [
                    {"member_id": marcus, "owed_amount": 35.00},
                    {"member_id": chloe, "owed_amount": 30.00},
                    {"member_id": maya, "owed_amount": 30.00},
                ],
                "category": "Shopping",
                "notes": "Hand-screenprinted Big Sur poster prints and postcards (Devon bought none)",
                "expense_date": "2026-08-16",
            },
        ]

        for exp in expenses_g2:
            r = client.post(f"/groups/{g2_id}/expenses", json=exp)
            r.raise_for_status()

        print(f"  -> Added {len(expenses_g2)} expenses to '{g2_name}'. Outstanding debts preserved.")

    # =========================================================================
    # GROUP 3: EUR (€) — Berlin Innovation Summit
    # =========================================================================
    g3_name = "Berlin Innovation Summit"
    if g3_name in existing_names:
        print(f"[SKIP] Group '{g3_name}' already exists.")
    else:
        print(f"[CREATE] Creating Group 3: '{g3_name}' (EUR)...")
        r = client.post("/groups", json={"name": g3_name, "currency": "EUR"})
        r.raise_for_status()
        g3 = r.json()
        g3_id = g3["id"]

        # 4 European culturally appropriate members
        members_data = ["Lukas Weber", "Camille Laurent", "Matteo Rossi", "Elena Vogel"]
        m_map = {}
        for m_name in members_data:
            r = client.post(f"/groups/{g3_id}/members", json={"name": m_name})
            r.raise_for_status()
            m = r.json()
            m_map[m_name] = m["id"]

        lukas = m_map["Lukas Weber"]
        camille = m_map["Camille Laurent"]
        matteo = m_map["Matteo Rossi"]
        elena = m_map["Elena Vogel"]
        all_4 = [lukas, camille, matteo, elena]

        # 9 realistic expenses
        expenses_g3 = [
            {
                "title": "Mitte Conference Loft (3 Nights)",
                "amount": 1200.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": lukas, "amount": 1200.00}],
                "participants": all_4,
                "category": "Accommodation",
                "notes": "Spacious team loft near Rosenthaler Platz for summit attendees",
                "expense_date": "2026-08-20",
            },
            {
                "title": "Tech Summit Full Access Pass Badges",
                "amount": 800.00,
                "split_method": "EQUAL",
                "payers": [
                    {"member_id": camille, "amount": 500.00},
                    {"member_id": matteo, "amount": 300.00},
                ],
                "participants": all_4,
                "category": "Activities",
                "notes": "Early bird registrations for Berlin Tech Arena keynote and expo",
                "expense_date": "2026-08-20",
            },
            {
                "title": "Betahaus Co-Working Day Passes & Meeting Room",
                "amount": 180.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": elena, "amount": 180.00}],
                "participants": all_4,
                "category": "Professional",
                "notes": "Day passes and 2-hour private soundproof conference room",
                "expense_date": "2026-08-21",
            },
            {
                "title": "Networking Dinner at Katz Orange",
                "amount": 276.40,
                "split_method": "EXACT",
                "payers": [{"member_id": matteo, "amount": 276.40}],
                "participants": all_4,
                "shares": [
                    {"member_id": lukas, "owed_amount": 72.00},
                    {"member_id": camille, "owed_amount": 68.40},
                    {"member_id": matteo, "owed_amount": 76.00},
                    {"member_id": elena, "owed_amount": 60.00},
                ],
                "category": "Restaurants",
                "notes": "Slow food sharing dishes and regional wine in courtyard",
                "expense_date": "2026-08-21",
            },
            {
                "title": "Berlin AB Transit 72h Metro & Tram Tickets",
                "amount": 96.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": elena, "amount": 96.00}],
                "participants": all_4,
                "category": "Transport",
                "notes": "BVG 72-hour tourist transit passes for S-Bahn and U-Bahn",
                "expense_date": "2026-08-21",
            },
            {
                "title": "Team Lunch at Markthalle Neun",
                "amount": 84.60,
                "split_method": "EQUAL",
                "payers": [{"member_id": camille, "amount": 84.60}],
                "participants": [lukas, camille, matteo],
                "category": "Restaurants",
                "notes": "Artisan street food and fresh juices in Kreuzberg (Elena was in client call)",
                "expense_date": "2026-08-22",
            },
            {
                "title": "Specialty Coffee & Pastries for Workshop",
                "amount": 58.50,
                "split_method": "EXACT",
                "payers": [
                    {"member_id": lukas, "amount": 30.00},
                    {"member_id": elena, "amount": 28.50},
                ],
                "participants": all_4,
                "shares": [
                    {"member_id": lukas, "owed_amount": 18.50},
                    {"member_id": camille, "owed_amount": 12.00},
                    {"member_id": matteo, "owed_amount": 14.00},
                    {"member_id": elena, "owed_amount": 14.00},
                ],
                "category": "Groceries",
                "notes": "The Barn flat whites and cinnamon buns for morning brainstorm",
                "expense_date": "2026-08-22",
            },
            {
                "title": "Futurium Exhibition & VR Lab Experience",
                "amount": 64.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": lukas, "amount": 64.00}],
                "participants": all_4,
                "category": "Activities",
                "notes": "Museum of Futures interactive exhibit and robot lab pass",
                "expense_date": "2026-08-22",
            },
            {
                "title": "Airport Express (FEX) Return Train Tickets",
                "amount": 46.00,
                "split_method": "EXACT",
                "payers": [{"member_id": camille, "amount": 46.00}],
                "participants": all_4,
                "shares": [
                    {"member_id": lukas, "owed_amount": 11.50},
                    {"member_id": camille, "owed_amount": 11.50},
                    {"member_id": matteo, "owed_amount": 11.50},
                    {"member_id": elena, "owed_amount": 11.50},
                ],
                "category": "Transport",
                "notes": "Flughafen BER express train transfers",
                "expense_date": "2026-08-23",
            },
        ]

        for exp in expenses_g3:
            r = client.post(f"/groups/{g3_id}/expenses", json=exp)
            r.raise_for_status()

        # Demonstrate several payments & partial settlement:
        # Camille settles full debt of €74.50 to Lukas
        client.post(
            f"/groups/{g3_id}/payments",
            json={
                "payer_id": camille,
                "recipient_id": lukas,
                "amount": 74.50,
                "payment_date": "2026-08-23",
                "notes": "Reimbursement for conference loft share via SEPA Instant",
            },
        ).raise_for_status()

        # Elena pays partial settlement of €200.00 to Lukas (out of €366.00 debt)
        client.post(
            f"/groups/{g3_id}/payments",
            json={
                "payer_id": elena,
                "recipient_id": lukas,
                "amount": 200.00,
                "payment_date": "2026-08-23",
                "notes": "Partial transfer for loft and conference badges",
            },
        ).raise_for_status()

        print(f"  -> Added {len(expenses_g3)} expenses & 2 payments to '{g3_name}'. Meaningful Settle Up preserved.")

    # =========================================================================
    # GROUP 4: GBP (£) — Cotswolds Walking Retreat (Fully Settled & Archived)
    # =========================================================================
    g4_name = "Cotswolds Walking Retreat"
    if g4_name in existing_names:
        print(f"[SKIP] Group '{g4_name}' already exists.")
    else:
        print(f"[CREATE] Creating Group 4: '{g4_name}' (GBP)...")
        r = client.post("/groups", json={"name": g4_name, "currency": "GBP"})
        r.raise_for_status()
        g4 = r.json()
        g4_id = g4["id"]

        # 4 British culturally appropriate members
        members_data = ["Oliver Thornton", "Harriet Wells", "Alfie Campbell", "Poppy Davies"]
        m_map = {}
        for m_name in members_data:
            r = client.post(f"/groups/{g4_id}/members", json={"name": m_name})
            r.raise_for_status()
            m = r.json()
            m_map[m_name] = m["id"]

        oliver = m_map["Oliver Thornton"]
        harriet = m_map["Harriet Wells"]
        alfie = m_map["Alfie Campbell"]
        poppy = m_map["Poppy Davies"]
        all_4 = [oliver, harriet, alfie, poppy]

        # 8 realistic expenses
        expenses_g4 = [
            {
                "title": "Bourton-on-the-Water Stone Cottage (Weekend)",
                "amount": 680.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": oliver, "amount": 680.00}],
                "participants": all_4,
                "category": "Accommodation",
                "notes": "Traditional honey-stone Cotswold cottage rental",
                "expense_date": "2026-07-10",
            },
            {
                "title": "Great Western Railway GroupSave Return Tickets",
                "amount": 192.00,
                "split_method": "EQUAL",
                "payers": [
                    {"member_id": harriet, "amount": 120.00},
                    {"member_id": alfie, "amount": 72.00},
                ],
                "participants": all_4,
                "category": "Travel",
                "notes": "Paddington to Moreton-in-Marsh off-peak return tickets",
                "expense_date": "2026-07-10",
            },
            {
                "title": "Farm Shop Provisions & Traditional Cider",
                "amount": 115.60,
                "split_method": "EQUAL",
                "payers": [{"member_id": poppy, "amount": 115.60}],
                "participants": all_4,
                "category": "Groceries",
                "notes": "Daylesford organic bread, cheeses, sausages, and local orchard cider",
                "expense_date": "2026-07-10",
            },
            {
                "title": "Dinner at The Wild Rabbit Kingham",
                "amount": 214.40,
                "split_method": "EXACT",
                "payers": [{"member_id": oliver, "amount": 214.40}],
                "participants": all_4,
                "shares": [
                    {"member_id": oliver, "owed_amount": 58.40},
                    {"member_id": harriet, "owed_amount": 52.00},
                    {"member_id": alfie, "owed_amount": 56.00},
                    {"member_id": poppy, "owed_amount": 48.00},
                ],
                "category": "Restaurants",
                "notes": "Locally sourced seasonal gastropub supper",
                "expense_date": "2026-07-11",
            },
            {
                "title": "Sudeley Castle & Gardens Admission",
                "amount": 86.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": harriet, "amount": 86.00}],
                "participants": [harriet, alfie, poppy],
                "category": "Activities",
                "notes": "Castle tour and Queen Katherine Parr exhibition (Oliver went on trail run)",
                "expense_date": "2026-07-11",
            },
            {
                "title": "Sunday Roast at Old Swan Pub Minster Lovell",
                "amount": 128.00,
                "split_method": "EQUAL",
                "payers": [
                    {"member_id": alfie, "amount": 70.00},
                    {"member_id": poppy, "amount": 58.00},
                ],
                "participants": all_4,
                "category": "Restaurants",
                "notes": "Roast beef, Yorkshire puddings, and riverside garden ales",
                "expense_date": "2026-07-12",
            },
            {
                "title": "Village Cream Tea & Warm Scones",
                "amount": 42.00,
                "split_method": "EXACT",
                "payers": [{"member_id": harriet, "amount": 42.00}],
                "participants": all_4,
                "shares": [
                    {"member_id": oliver, "owed_amount": 10.50},
                    {"member_id": harriet, "owed_amount": 10.50},
                    {"member_id": alfie, "owed_amount": 10.50},
                    {"member_id": poppy, "owed_amount": 10.50},
                ],
                "category": "Restaurants",
                "notes": "Clotted cream, strawberry jam, and pots of Earl Grey",
                "expense_date": "2026-07-12",
            },
            {
                "title": "Local Minibus Taxi to Moreton-in-Marsh Station",
                "amount": 48.00,
                "split_method": "EQUAL",
                "payers": [{"member_id": alfie, "amount": 48.00}],
                "participants": all_4,
                "category": "Travel",
                "notes": "Station transfer with backpacks and walking boots",
                "expense_date": "2026-07-12",
            },
        ]

        for exp in expenses_g4:
            r = client.post(f"/groups/{g4_id}/expenses", json=exp)
            r.raise_for_status()

        # Check balances before settlement
        bal_res = client.get(f"/groups/{g4_id}/balances")
        bal_res.raise_for_status()
        b_list = bal_res.json()
        b_dict = {b["member_name"]: b["net_balance"] for b in b_list}
        print(f"  Balances before settlement in '{g4_name}': {b_dict}")

        # Record exact payments to achieve fully settled state:
        # Harriet owes Oliver 134.07
        client.post(
            f"/groups/{g4_id}/payments",
            json={
                "payer_id": harriet,
                "recipient_id": oliver,
                "amount": 134.07,
                "payment_date": "2026-07-13",
                "notes": "Cotswolds cottage settlement via Faster Payments",
            },
        ).raise_for_status()

        # Alfie owes Oliver 196.07
        client.post(
            f"/groups/{g4_id}/payments",
            json={
                "payer_id": alfie,
                "recipient_id": oliver,
                "amount": 196.07,
                "payment_date": "2026-07-13",
                "notes": "Final balance settlement via Monzo",
            },
        ).raise_for_status()

        # Poppy owes Oliver 204.46
        client.post(
            f"/groups/{g4_id}/payments",
            json={
                "payer_id": poppy,
                "recipient_id": oliver,
                "amount": 204.46,
                "payment_date": "2026-07-13",
                "notes": "Retreat expenses balance cleared",
            },
        ).raise_for_status()

        # Check balances after settlement
        bal_res = client.get(f"/groups/{g4_id}/balances")
        bal_res.raise_for_status()
        b_list_after = bal_res.json()
        b_dict_after = {b["member_name"]: b["net_balance"] for b in b_list_after}
        print(f"  Balances after settlement in '{g4_name}': {b_dict_after}")
        assert all(abs(b["net_balance"]) < 0.005 for b in b_list_after), "All balances must be zero"

        # Archive group (demonstrating archive lifecycle)
        arch_res = client.post(f"/groups/{g4_id}/archive")
        arch_res.raise_for_status()
        arch_group = arch_res.json()
        print(f"  -> Successfully archived '{g4_name}' (status: {arch_group['status']})")

    print("\n--- Seeding completed successfully! ---")


if __name__ == "__main__":
    seed()
