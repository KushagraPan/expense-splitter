# AGENTS.md — Expense Splitter

## 1. Project Overview & Repository Context
This repository contains the **Expense Splitter** application (DataTalksClub AI Dev Tools Zoomcamp — Module 2).
- **Repository Root:** `D:\project directory\ai-devtools\expense-splitter` (current workspace).
- **Strict Isolation:** Do NOT access, view, copy from, or modify any files outside this repository (specifically `flatmate-chore-manager`). This is an independent project.

---

## 2. Authoritative Source Documents
- **Product Specification:** [`product-spec.md`](product-spec.md) is the **authoritative product specification**. All domain logic, financial models, validation rules, lifecycle behaviors, and acceptance criteria are defined here.
- **Development Plan:** [`_docs/plan.md`](_docs/plan.md) is the **authoritative development plan**. It establishes the technical stack, progression stages, and development strategy.
- **Actionable Backlog:** [`_docs/backlog.md`](_docs/backlog.md) contains the **16 planned implementation issues** detailing objectives, scopes, dependencies, and acceptance criteria.

---

## 3. Core Rules of Engagement for Coding Agents

1. **Single-Issue Focus:** Implement ONLY the currently assigned GitHub issue. Do not work ahead or touch unrelated modules.
2. **No Speculative Scope:** Do not add unrequested features, libraries, configuration options, or speculative abstractions. If it is not in the active issue, `_docs/backlog.md`, or `product-spec.md`, do not write it.
3. **No Silent Rule Invention:** Never silently invent business rules or settle financial edge cases independently. If a calculation ambiguity or product contradiction arises, **halt immediately and ask the user for clarification**.
4. **Inspect Before Modifying:** Always review existing files and interfaces before writing or editing code. Maintain consistency in naming and architecture.
5. **Architectural Separation:**
   - Keep frontend (`frontend/`) and backend (`backend/`) strictly decoupled.
   - The frontend interacts with a centralized service layer, not direct backend internals.
   - The OpenAPI 3.1 specification (`openapi.yaml`) is the single source of truth contract bridging frontend and backend.
6. **Follow the Development Progression:**
   - **Phase C:** React frontend prototype backed by a centralized in-memory mock service layer.
   - **Phase D:** Canonical OpenAPI specification.
   - **Phase E:** FastAPI backend with in-memory store.
   - **Phase F:** Frontend-backend integration via HTTP client.
   - **Phase G:** SQLite + SQLAlchemy 2.0 persistence.
   - **Phase H:** Comprehensive automated test verification.
   - *Do not jump steps or introduce persistence prematurely.*
7. **Verify Against Acceptance Criteria:**
   - Run relevant tests, linters, and type-checks (`tsc`, `pytest`) after implementation.
   - Never consider a task complete until its Acceptance Criteria (from `product-spec.md`) are explicitly verified.
8. **Definition of Done Compliance:** Ensure all 8 criteria in `_docs/plan.md` (Definition of Done) are satisfied before requesting human review.
