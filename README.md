# Expense Splitter

The **Expense Splitter** is a lightweight, web-based shared expense tracker designed for groups of friends, colleagues, or flatmates managing shared costs during finite events (such as trips, dinners, or outings). It serves as a shared ledger where members log expenses, the system maintains real-time net balances, and a debt simplification engine suggests direct debtor-to-creditor settlements to clear all debts in at most $N-1$ transactions without requiring user authentication.

---

## Current Status

**Status:** Specification and planning complete; implementation not yet started.  
Application source code has not yet been initialized. Implementation proceeds sequentially according to the phased development plan.

---

## Technology Stack

- **Frontend:** React 18+, TypeScript, Vite
- **Backend:** Python 3.11+, FastAPI (`uv` package manager)
- **Persistence:** SQLite via SQLAlchemy 2.0
- **API Contract:** OpenAPI 3.1
- **Testing:** Vitest (Frontend), pytest (Backend)

---

## Documentation Links

- **Product Specification:** [`product-spec.md`](product-spec.md) — Authoritative product requirements, financial balance model, rounding invariants, and testable acceptance criteria.
- **Development Plan:** [`_docs/plan.md`](_docs/plan.md) — Architectural progression, phased milestones, and development strategy.
- **Actionable Backlog:** [`_docs/backlog.md`](_docs/backlog.md) — Detailed 16 planned implementation issues with explicit scopes and acceptance criteria.
- **Agent Operating Rules:** [`AGENTS.md`](AGENTS.md) — Development protocol and scope boundaries for AI coding agents.
