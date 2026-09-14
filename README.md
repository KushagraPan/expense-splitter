# Expense Splitter

A lightweight, full-stack web application for tracking and settling shared expenses during trips, dinners, events, or shared living.

Expense Splitter operates as a transparent shared ledger: members log expenses, the system computes real-time net balances using deterministic cent-precision mathematics, and a debt simplification algorithm suggests the minimal number of direct debtor-to-creditor payments needed to settle all accounts.

> **Project Origin:** Developed as part of the **DataTalksClub AI Dev Tools Zoomcamp (Module 2)**.

---

## Key Features & Current Implementation

The application is fully implemented across frontend, backend API, domain logic, and persistence layers:

- **Multi-Group Dashboard:** View and filter groups by status (`All`, `Active`, `Archived`) with real-time group counters.
- **Member-Scoped Visibility & "Viewing As" Persona Selector:** In this intentional zero-authentication prototype, users select any group member from the "Viewing as" selector to view dashboard balances and group ledgers from that specific member's financial perspective.
- **Multi-Currency Active Balances Hero:** Summarizes your net positions across active groups, partitioned cleanly by currency without cross-currency mathematical conversions.
- **Group & Member Management:**
  - Create groups with automatic creator enrolment.
  - Add members with uniqueness validation.
  - Safe member deletion enforcing the zero-history rule (prevents deleting any member with financial history).
- **Expense Logging & Flexible Splitting:**
  - Multiple payers per expense with exact contributions.
  - Split evenly (`EQUAL`) or with custom amounts (`EXACT`) across any participant subset.
  - Deterministic money handling (distributes rounding fractions penny-by-penny to ensure sum of shares identically matches the total).
  - Edit and delete existing expenses.
- **Real-Time Derived Balances:**
  - Net balances, total paid, and total owed calculated on-the-fly from the underlying immutable ledger.
- **Debt Simplification & Settle Up:**
  - Computes the minimum number of transactions (at most $N-1$) to square away all members.
  - Actionable settlement cards with direct "Record Payment" workflows.
- **Payment Tracking & History:**
  - Record full, partial, or standalone payments between members.
  - Immutable payment history feed with timestamped records and notes.
- **Group Lifecycle Management:**
  - Archive completed groups (requires all debts to be fully settled).
  - Archived groups are strictly read-only, protecting historical financial records.
  - Reopen archived groups at any time to resume activity.
- **Responsive UI:** Custom Aegean-themed warm design refined for desktop and mobile viewports down to 375px.

---

## Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite | Single-page application, responsive layout, interactive forms |
| **Styling** | Modern CSS (Design Tokens) | Responsive Aegean color palette, card components, mobile layouts |
| **Backend API** | FastAPI, Python 3.12, Pydantic v2 | High-performance RESTful API enforcing request/response schemas |
| **Package Manager** | `uv` | Ultra-fast Python package installation and environment resolution |
| **Persistence** | SQLite via SQLAlchemy 2.0 | Transactional local persistence with declarative ORM models |
| **API Contract** | OpenAPI 3.1 (`openapi.yaml`) | Single source of truth bridging backend routers and frontend client |
| **Testing** | pytest, pytest-asyncio | Comprehensive domain, API, and persistence test verification |
| **Linting** | oxlint | Fast frontend TypeScript and React code linting |

---

## Architecture

The project maintains strict decoupling between the presentation layer and backend persistence:

```text
┌──────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                  │
│   GroupDashboard ─── GroupDetail ─── PersonaSelector     │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTP / JSON
                             ▼
┌──────────────────────────────────────────────────────────┐
│                   FastAPI Backend API                    │
│   /api/groups  ───  /members  ───  /expenses ─── /payments│
└──────────────┬────────────────────────────┬──────────────┘
               │                            │
               ▼                            ▼
┌─────────────────────────────┐ ┌──────────────────────────┐
│  Domain Calculation Engine  │ │ SQLAlchemy 2.0 Repository│
│  - Net balance derivation   │ │ - Transaction management │
│  - Rounding invariants      │ │ - Foreign key integrity  │
│  - Debt simplification      │ │ - Group lifecycle rules  │
└─────────────────────────────┘ └───────────┬──────────────┘
                                            │
                                            ▼
                                ┌──────────────────────────┐
                                │   SQLite Database File   │
                                │   (expense_splitter.db)  │
                                └──────────────────────────┘
```

- **Single Source of Truth Contract:** All API endpoints, path parameters, and request/response models strictly implement [`openapi.yaml`](openapi.yaml).
- **Derived Financial Computations:** Net balances and settlement suggestions are never stored as denormalized database columns; they are computed deterministically from base expense and payment ledgers.

---

## Supported Currencies

Each group selects one currency at creation time, which remains uniform for all expenses and settlements within that group:

- **INR (`₹`)** — Indian Rupee
- **USD (`$`)** — US Dollar
- **EUR (`€`)** — Euro
- **GBP (`£`)** — British Pound

*(Multi-currency foreign exchange rates and mixed-currency groups are intentionally out of scope).*

---

## Getting Started Locally

### Prerequisites

- **Node.js** 18+ and `npm`
- **Python** 3.11+
- **`uv`** (recommended Python package manager) or standard `pip`

### 1. Start the Backend

From the repository root:

```bash
cd backend

# Install dependencies
uv sync --all-extras

# Launch FastAPI development server
uv run uvicorn app.main:app --reload
```

The backend server runs at `http://localhost:8000`.  
Interactive Swagger API documentation is available at `http://localhost:8000/docs`.

### 2. Start the Frontend

From the repository root in a separate terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend application runs at `http://localhost:5173`.  
It communicates with the backend via `http://localhost:8000/api` (configurable via the `VITE_API_BASE_URL` environment variable).

---

## Demo Data

The repository includes an idempotent demo data seeding script that populates 4 realistic demonstration groups across all supported currencies:

```bash
cd backend
uv run python scripts/seed_demo_data.py
```

The script is idempotent—running it multiple times will not duplicate groups if they already exist.

### Seeded Demonstration Scenarios

1. **Goa Weekend Getaway (`INR ₹` — Active):**
   - 5 members: Aarav Sharma, Priya Patel, Rohan Mehta, Ananya Iyer, Kabir Verma
   - 9 expenses covering villa rentals, beach dinners, scooty rentals, and scuba diving
   - Demonstrates multi-payer expenses and unequal debtor/creditor balances
2. **Pacific Coast Highway Trip (`USD $` — Active):**
   - 4 members: Marcus Vance, Chloe Bennett, Devon Reed, Maya Lin
   - 9 expenses covering SUV rentals, coastal cabins, fuel, and seafood dinners
   - Demonstrates multiple creditors and debtors with fractional-cent splitting
3. **Berlin Innovation Summit (`EUR €` — Active):**
   - 4 members: Lukas Weber, Camille Laurent, Matteo Rossi, Elena Vogel
   - 9 expenses and 2 recorded payments
   - Demonstrates partial debt settlement workflows where one member is fully squared away
4. **Cotswolds Walking Retreat (`GBP £` — Archived):**
   - 4 members: Oliver Thornton, Harriet Wells, Alfie Campbell, Poppy Davies
   - 8 expenses and 3 recorded payments
   - Demonstrates a 100% settled group archived in read-only status

---

## Running Tests

The backend test suite thoroughly validates acceptance criteria, financial invariants, edge cases, lifecycle rules, and database persistence.

To execute the test suite:

```bash
cd backend
uv run pytest
```

### Current Test Verification

```text
============================= 56 passed in 11.66s =============================
```

- **56 passing automated tests** across:
  - `test_acceptance_criteria.py`: Invariant and acceptance criteria verification
  - `test_api.py`: Comprehensive REST API endpoint tests
  - `test_api_edge_cases.py`: Zero-amount, empty-group, and validation boundary tests
  - `test_domain.py`: Debt simplification, equal/exact splits, and rounding logic
  - `test_iteration3_payments.py`: Payment recording, partial debt clearance, and ledger updates
  - `test_persistence.py`: SQLite schema, foreign keys, transaction rollback, and restart survival
  - `test_health.py`: Service health and heartbeat endpoints
- Test execution runs in an isolated temporary database via `backend/tests/conftest.py` to ensure local demo data is never altered by automated test runs.

To run the frontend linter and type-check:

```bash
cd frontend
npm run lint    # oxlint: 0 errors, 0 warnings
npm run build   # TypeScript compilation & Vite production bundle
```

---

## Project Structure

```text
expense-splitter/
├── openapi.yaml               # Canonical OpenAPI 3.1 contract
├── product-spec.md            # Authoritative domain logic & acceptance criteria
├── AGENTS.md                  # Development protocol for AI coding agents
├── README.md                  # Project overview and local execution guide
├── _docs/
│   ├── plan.md                # Phased development plan
│   └── backlog.md             # Implementation backlog (Issues #1–#16)
├── backend/
│   ├── pyproject.toml         # Python project dependencies & metadata
│   ├── app/
│   │   ├── main.py            # FastAPI entry point & CORS configuration
│   │   ├── database.py        # SQLAlchemy engine and session factory
│   │   ├── models.py          # SQLAlchemy ORM table definitions
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── repository.py      # SQLite database repository implementation
│   │   ├── store.py           # In-memory store (used in prototype stage)
│   │   ├── api/
│   │   │   └── router.py      # REST endpoint routes
│   │   └── domain/
│   │       └── calculations.py# Core financial & debt simplification algorithms
│   ├── scripts/
│   │   ├── seed_demo_data.py  # Idempotent seed script for 4 demo groups
│   │   └── verify_demo_data.py# Ledger consistency & balance verification script
│   └── tests/
│       ├── conftest.py        # Pytest database isolation fixtures
│       ├── test_acceptance_criteria.py
│       ├── test_api.py
│       ├── test_api_edge_cases.py
│       ├── test_domain.py
│       ├── test_iteration3_payments.py
│       ├── test_persistence.py
│       └── test_health.py
└── frontend/
    ├── package.json           # Frontend dependencies & npm scripts
    ├── vite.config.ts         # Vite build configuration
    ├── src/
    │   ├── App.tsx            # Main application component & URL hash routing
    │   ├── App.css            # Application styling & design system
    │   ├── main.tsx           # React DOM entry point
    │   ├── components/
    │   │   ├── GroupDashboard.tsx # Multi-group dashboard & persona selector
    │   │   └── GroupDetail.tsx    # Group ledger, expenses, settlements & payments
    │   ├── services/
    │   │   ├── api.ts         # Centralized API service layer
    │   │   └── mockStore.ts   # Client-side mock store (prototype phase)
    │   ├── types/
    │   │   └── index.ts       # TypeScript interfaces matching OpenAPI schemas
    │   └── utils/
    │       └── avatar.ts      # Deterministic avatar background generator
```

---

## Scope & Boundaries

To preserve focus as a lightweight event expense tracker:
- **No User Accounts or Passwords:** The prototype relies on transparent shared ledgers with the "Viewing as" persona switcher.
- **Single Currency per Group:** Expenses and settlements operate within the chosen currency of each group without live FX rates.
- **Local SQLite Persistence:** Uses a single local SQLite database file (`expense_splitter.db`).
