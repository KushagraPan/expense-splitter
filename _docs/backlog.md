# Expense Splitter — Implementation Backlog

**Project:** Expense Splitter (DataTalksClub AI Dev Tools Zoomcamp — Module 2)  
**Status:** Planned Backlog (Pre-Issue Creation)  
**Document Version:** 1.0  
**Target Path:** `_docs/backlog.md`  
**Reference Specification:** [`product-spec.md`](../product-spec.md)  
**Development Strategy:** [`_docs/plan.md`](plan.md)

---

## Overview

This document defines the 16 detailed, actionable implementation backlog items that will be converted into GitHub Issues during Phase B. Each issue is self-contained, specifies explicit boundaries, and references testable criteria from `product-spec.md`.

---

## Phase C: React Frontend Prototype (Mock Service Layer)

### Issue #1: Scaffold React + TS + Vite Application with Mock Service Layer
- **Phase:** Phase C (Frontend Prototype)
- **Objective:** Establish the frontend project structure with TypeScript types matching the product specification and an in-memory mock service layer.
- **Scope:**
  - Initialize Vite React project with TypeScript in `frontend/`.
  - Configure basic layout and CSS styling framework.
  - Define domain TypeScript interfaces in `frontend/src/types/index.ts` (`Group`, `Member`, `Expense`, `ExpenseShare`, `Payment`, `NetBalance`, `SettlementSuggestion`).
  - Create centralized mock API store in `frontend/src/services/mockStore.ts` with pre-seeded sample data.
  - Create service interface in `frontend/src/services/api.ts` abstracting data operations.
- **Dependencies:** None.
- **Acceptance Criteria / Verification:**
  - `npm run dev` successfully launches the Vite development server.
  - `npm run build` / `tsc --noEmit` compiles without type errors.
  - Mock store provides reactive/async functions for listing groups, members, and expenses.
- **Non-Goals:**
  - Real backend HTTP calls.
  - Full UI screen implementations (covered in subsequent issues).

---

### Issue #2: Implement Group Dashboard and Local Navigation
- **Phase:** Phase C (Frontend Prototype)
- **Objective:** Allow users to view existing groups, create new groups with currency selection, and switch between groups.
- **Scope:**
  - Build dashboard view listing available groups from the service layer.
  - Build "Create Group" modal capturing `name` and `currency` (e.g., INR, USD, EUR).
  - Persist recently visited/created group IDs in browser `localStorage`.
  - Implement client-side routing/URL navigation (`/groups/{groupId}`).
- **Dependencies:** Issue #1.
- **Acceptance Criteria / Verification:**
  - **AC-G1:** User creates "Goa Trip" with currency "INR"; group appears in dashboard in `ACTIVE` state with shareable URL.
  - Refreshing the page preserves recently viewed groups in the dashboard.
- **Non-Goals:**
  - User accounts or authentication.

---

### Issue #3: Implement Member Management with Zero-History Safety
- **Phase:** Phase C (Frontend Prototype)
- **Objective:** Allow viewing, adding, and safely deleting named group members.
- **Scope:**
  - Build Member Manager panel inside the group view.
  - "Add Member" input form with uniqueness validation within the group.
  - "Delete Member" button enforcing the **Zero-History Rule**:
    - Disallow/disable deletion if the member is referenced in any expense (as payer or participant) or payment (as payer or recipient).
    - Display clear error message if deletion is rejected.
- **Dependencies:** Issue #2.
- **Acceptance Criteria / Verification:**
  - **AC-G2:** Adding member "Alice" adds her to the group list.
  - **AC-G3:** Deleting unreferenced member "Bob" successfully removes him.
  - **AC-G4:** Attempting to delete a member who participated in an expense displays `Cannot delete member with existing financial history`.
  - **EC-15:** Attempting to add duplicate member name within the same group is rejected.
- **Non-Goals:**
  - User profile photos or email invitations.

---

### Issue #4: Implement Expense Creation with Equal and Exact Splits
- **Phase:** Phase C (Frontend Prototype)
- **Objective:** Provide form modal for logging single-payer expenses with equal and exact split mechanisms.
- **Scope:**
  - "Add Expense" modal: Title, Amount, Payer (single dropdown), Participants (multi-select checkboxes), Split Method (`EQUAL` vs `EXACT`), Date (defaults to today, editable), optional Notes.
  - Implement **Deterministic Cent Remainder Allocation** for `EQUAL` split (+0.01 sequentially in participant order).
  - Implement **Sum Completeness Validation** for `EXACT` split ($\sum \text{shares} == \text{amount}$).
  - Support payer exclusion from participants (payer pays for others).
- **Dependencies:** Issue #3.
- **Acceptance Criteria / Verification:**
  - **AC-E1:** ₹100.00 equal split across [Alice, Bob, Charlie] allocates ₹33.34, ₹33.33, ₹33.33.
  - **AC-E2:** ₹100.00 exact split (Alice ₹40.00, Bob ₹60.00) saves correctly.
  - **AC-E3:** ₹100.00 exact split with mismatched shares (₹40.00 + ₹50.00) shows validation error.
  - **AC-E4:** Expense paid by Alice for Bob only (Alice excluded) is accepted.
  - **EC-01 / EC-02:** Zero or negative amounts are rejected.
- **Non-Goals:**
  - Multi-payer expenses; receipt uploads; percentage/shares splitting.

---

### Issue #5: Implement Expense List, Editing, and Deletion View
- **Phase:** Phase C (Frontend Prototype)
- **Objective:** Display chronological expense history with details breakdown, editing, and deletion.
- **Scope:**
  - Expense card list displaying date, title, payer, total amount, and participant tags with individual shares.
  - "Edit Expense" action opening the expense modal pre-populated with existing data.
  - "Delete Expense" confirmation action.
  - Connect actions to service layer with dynamic state refresh.
- **Dependencies:** Issue #4.
- **Acceptance Criteria / Verification:**
  - Editing an expense modifies its fields in the mock store and updates the UI.
  - Deleting an expense removes it from the list.
- **Non-Goals:**
  - Full-text search or complex filtering.

---

### Issue #6: Implement Live Net Balance and Settlement Suggestions UI
- **Phase:** Phase C (Frontend Prototype)
- **Objective:** Calculate and display real-time member net balances and debtor-creditor settlement suggestions.
- **Scope:**
  - Implement frontend net balance calculation function ($\sum \text{Net} = 0.00$).
  - Display Net Balance cards for each member (color-coded: green for creditor, red for debtor, gray for settled).
  - Implement debtor-creditor matching algorithm ($\le N-1$ transactions).
  - Display "Who Owes Whom" simplified settlement card showing recommended payments.
- **Dependencies:** Issue #5.
- **Acceptance Criteria / Verification:**
  - **AC-S1:** Given Alice: +₹100, Bob: +₹50, Charlie: -₹150, suggestions display: Charlie pays Alice ₹100, Charlie pays Bob ₹50.
  - Balance updates dynamically whenever an expense is added, edited, or deleted.
- **Non-Goals:**
  - Payment execution/recording (handled in Issue #7).

---

### Issue #7: Implement Payment Recording and Partial Settlement UI
- **Phase:** Phase C (Frontend Prototype)
- **Objective:** Allow members to record first-class cash settlements against the suggested settlement plan.
- **Scope:**
  - "Record Payment" button on each settlement suggestion item.
  - Payment modal pre-filled with suggested payer, recipient, and max amount.
  - Support full payment and partial payment input.
  - Payment validation gate: block payments exceeding suggested amount or to non-creditors.
  - Payment history list displaying chronological cash transfers.
  - Verify dynamic recalculation and debt inversion (refunds) if past expenses are edited/deleted.
- **Dependencies:** Issue #6.
- **Acceptance Criteria / Verification:**
  - **AC-P1:** Recording ₹40 payment against ₹100 suggestion leaves ₹60 remaining debt.
  - **AC-P2:** Recording payment exceeding suggested amount is blocked.
  - **AC-P3:** Recording payment to a non-creditor is blocked.
  - **AC-ED1:** Expense increased after full payment recalculates outstanding balance correctly.
  - **AC-ED2:** Expense deleted after payment inverts balance and generates reverse refund suggestion.
- **Non-Goals:**
  - External payment gateway (Stripe/UPI).

---

### Issue #8: Implement Group Archiving and Reopening Lifecycle UI
- **Phase:** Phase C (Frontend Prototype)
- **Objective:** Support group closing and read-only state enforcement when all debts are settled.
- **Scope:**
  - "Archive Group" button with pre-condition validation: all member net balances must equal ₹0.00.
  - Archived view banner displaying `ARCHIVED` status.
  - Read-only UI enforcement: hide or disable all Add/Edit/Delete actions for members, expenses, and payments.
  - "Reopen Group" button restoring `ACTIVE` status and edit capabilities.
- **Dependencies:** Issue #7.
- **Acceptance Criteria / Verification:**
  - **AC-A1:** Attempting to archive with any non-zero balance is blocked with error message.
  - **AC-A2:** Archiving with all ₹0.00 balances succeeds.
  - **AC-A3:** Archived group UI prevents any mutations.
  - **AC-A4:** Clicking "Reopen Group" unlocks the group back to `ACTIVE`.
- **Non-Goals:**
  - Permanent deletion of groups from database.

---

## Phase D: OpenAPI Contract

### Issue #9: Define Canonical OpenAPI 3.1 Specification
- **Phase:** Phase D (API Contract)
- **Objective:** Author the formal HTTP REST API contract bridging frontend and backend.
- **Scope:**
  - Create `openapi.yaml` documenting all endpoints, request bodies, query params, responses, and error schemas:
    - `/groups`, `/groups/{id}`
    - `/groups/{id}/members`, `/groups/{id}/members/{member_id}`
    - `/groups/{id}/expenses`, `/groups/{id}/expenses/{expense_id}`
    - `/groups/{id}/payments`
    - `/groups/{id}/balances`
    - `/groups/{id}/settlements`
    - `/groups/{id}/archive`, `/groups/{id}/reopen`
  - Define validation error schemas (400, 403, 404).
- **Dependencies:** Issue #8 (validated frontend data contracts).
- **Acceptance Criteria / Verification:**
  - `openapi.yaml` passes validation using standard OpenAPI 3.1 CLI / linter.
  - Every frontend mock service operation maps 1:1 to an OpenAPI path and schema.
- **Non-Goals:**
  - Backend implementation code.

---

## Phase E: FastAPI Backend (Mock / In-Memory Store)

### Issue #10: Scaffold FastAPI Project with In-Memory Repository
- **Phase:** Phase E (Backend Foundation)
- **Objective:** Initialize Python FastAPI backend environment using `uv` with an in-memory repository.
- **Scope:**
  - Set up `backend/pyproject.toml` with `fastapi`, `uvicorn`, `pydantic`.
  - Configure FastAPI application instance with CORS middleware.
  - Implement in-memory data store structure matching the OpenAPI schemas.
- **Dependencies:** Issue #9.
- **Acceptance Criteria / Verification:**
  - `uv run uvicorn app.main:app --reload` runs cleanly on `http://localhost:8000`.
  - `/docs` Swagger UI loads and reflects the OpenAPI contract.
- **Non-Goals:**
  - Database persistence.

---

### Issue #11: Implement Domain Calculation Engine with Unit Tests
- **Phase:** Phase E (Domain Logic)
- **Objective:** Implement isolated, pure Python domain functions for net balance calculation, remainder allocation, and debtor-creditor settlement matching.
- **Scope:**
  - Implement `calculate_net_balances(expenses, payments)` maintaining $\sum \text{Net} = 0.00$.
  - Implement `calculate_simplified_settlements(net_balances)` producing $\le N-1$ transactions.
  - Implement `allocate_equal_shares(total_cents, participant_ids)` for deterministic sequential cent rounding.
  - Write comprehensive `pytest` unit tests for all domain functions.
- **Dependencies:** Issue #10.
- **Acceptance Criteria / Verification:**
  - Unit tests verify AC-E1, AC-S1, AC-ED1, AC-ED2 with 100% pass rate.
  - `pytest tests/test_domain_calculations.py` passes without errors.
- **Non-Goals:**
  - HTTP routing.

---

### Issue #12: Implement FastAPI Endpoints with Domain Validations
- **Phase:** Phase E (API Routes)
- **Objective:** Wire HTTP route handlers to the domain engine and in-memory store with strict validation enforcement.
- **Scope:**
  - Implement route handlers for groups, members, expenses, payments, settlements, and lifecycle transitions.
  - Enforce validations:
    - 400 on negative/zero amounts.
    - 400 on exact split mismatches.
    - 400 on payments exceeding suggested plan.
    - 400 on deleting members with financial history.
    - 400 on archiving with non-zero balances.
    - 403 on mutations against archived groups.
  - Write automated API integration tests using `httpx.AsyncClient`.
- **Dependencies:** Issue #11.
- **Acceptance Criteria / Verification:**
  - `pytest tests/test_api_endpoints.py` tests all success and error status codes.
- **Non-Goals:**
  - SQLite persistence.

---

## Phase F: Frontend / Backend Integration

### Issue #13: Connect React Frontend to Live FastAPI Backend
- **Phase:** Phase F (Integration)
- **Objective:** Switch the frontend centralized service layer from mock data to live HTTP calls against the FastAPI server.
- **Scope:**
  - Implement `frontend/src/services/httpClient.ts` using `fetch`.
  - Wire `frontend/src/services/api.ts` to forward requests to the live backend.
  - Propagate backend HTTP error responses to UI alerts and toast notifications.
  - Verify complete end-to-end user workflows in browser against running backend.
- **Dependencies:** Issue #12.
- **Acceptance Criteria / Verification:**
  - User can create group, add members, log expenses, record payments, and archive group with live network requests.
  - Validation errors from backend display accurately in the frontend.
- **Non-Goals:**
  - SQLite database.

---

## Phase G: SQLite + SQLAlchemy Persistence

### Issue #14: Implement SQLite Persistence via SQLAlchemy 2.0
- **Phase:** Phase G (Persistence)
- **Objective:** Replace in-memory backend repository with SQLite database managed via SQLAlchemy 2.0.
- **Scope:**
  - Define SQLAlchemy models: `GroupModel`, `MemberModel`, `ExpenseModel`, `ExpenseShareModel`, `PaymentModel`.
  - Configure SQLite engine with foreign keys enabled (`PRAGMA foreign_keys=ON`).
  - Update route handlers to commit transactions through SQLAlchemy sessions.
- **Dependencies:** Issue #13.
- **Acceptance Criteria / Verification:**
  - Restarting the FastAPI server preserves all groups, expenses, payments, and statuses.
  - Foreign key constraints prevent orphaned records.
  - All existing API tests continue to pass.
- **Non-Goals:**
  - PostgreSQL / cloud databases.

---

## Phase H: Automated Verification & Final Sign-Off

### Issue #15: Execute Comprehensive Test Suite for Frontend and Backend
- **Phase:** Phase H (Testing & QA)
- **Objective:** Run full automated test suites across frontend and backend verifying all edge cases and invariants.
- **Scope:**
  - Backend: Run full `pytest` suite covering unit, domain, API, and persistence tests.
  - Frontend: Run `vitest` unit tests verifying calculations, split rounding, and component states.
  - Verify all 15 edge cases (EC-01 to EC-15) from `product-spec.md`.
- **Dependencies:** Issue #14.
- **Acceptance Criteria / Verification:**
  - Zero test failures across both frontend and backend suites.
  - Zero TypeScript compiler errors (`tsc --noEmit`).
- **Non-Goals:**
  - Heavy end-to-end browser automation suites.

---

### Issue #16: Complete Acceptance Criteria Walkthrough and Project Documentation
- **Phase:** Phase H (Sign-Off)
- **Objective:** Conduct manual verification walkthrough against all Acceptance Criteria and finalize repository documentation.
- **Scope:**
  - Walk through all criteria (AC-G1 through AC-A4) in a live environment.
  - Update `README.md` with complete setup, running, and verification instructions.
  - Document verification sign-off confirming full compliance with `product-spec.md`.
- **Dependencies:** Issue #15.
- **Acceptance Criteria / Verification:**
  - All ACs confirmed passing.
  - Documentation clean, consistent, and ready for submission.
- **Non-Goals:**
  - New feature development.
