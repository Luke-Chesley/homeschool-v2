# Phase 0 + Phase 1 Implementation Plan (Execution-Ready)

This document translates the activation launch strategy into an implementation plan for the current `homeschool-v2` codebase.

Scope covered:
- Phase 0: Launch Scope and Activation Model
- Phase 1: Fast-Path Onboarding

This is a planning artifact only. No product behavior changes are included in this document.

---

## 1) Goals, Non-Goals, and Dependencies

## Goals
- Lock the launch wedge, activation definition, and first-week retention loop in code-facing terms.
- Refactor onboarding from a one-pass household setup into a fast path that reaches `Today` with minimal required input.
- Add milestone-based onboarding state tracking and event instrumentation to measure activation drop-off.
- Preserve existing auth/session/workspace architecture and learner-scoped data patterns.

## Non-Goals (for these phases)
- No full importer matrix expansion.
- No native mobile packaging.
- No full billing implementation.
- No major redesign of planning/curriculum/tracking feature depth.

## Dependencies / Preconditions
- Existing auth and workspace setup remain the gate (`/auth/setup` + workspace cookies).
- Existing learner-scoped planning and curriculum services remain the generation backbone.
- Existing observability/event path is the first instrumentation sink.

---

## 2) Current-State Summary (What We Are Replacing)

The current flow is effectively:
1. `/auth/setup` creates household workspace.
2. `/onboarding` collects full household defaults + learner profile + curriculum mode + curriculum details in one pass.
3. API completion performs durable setup + generation and redirects to `/today`.

This produces value too late for launch activation, because first value is blocked behind full setup.

---

## 3) Phase 0 — Execution Plan

## 3.1 Product/Policy Decisions to Lock (code-adjacent)
1. **Activation event definition**
   - Primary activation = first successful `Today` open after first intake + first generated output.
2. **Retention event definitions**
   - D2 return, D7 return, week-1 Today opens, week-1 status updates, week-1 learner additions.
3. **Deferrals registry**
   - Explicitly mark launch deferrals in docs and reference from implementation tickets.
4. **Launch plan envelope**
   - Household billing unit policy (up to learner cap target) without implementing Stripe in this phase.
5. **Surface commitment**
   - Responsive web + optional PWA polish; no native app commitment.

## 3.2 Codebase Work Items

### A) Introduce canonical event contracts for activation metrics
- Add a typed event map in platform observability layer for:
  - `onboarding_started`
  - `learner_name_submitted`
  - `intake_type_selected`
  - `intake_source_submitted`
  - `generation_started`
  - `generation_completed`
  - `first_today_opened`
  - `first_plan_item_status_change`
  - `refinement_prompt_opened`
  - `refinement_completed`
  - `onboarding_abandoned_before_today`
  - `returned_day_2`
  - `returned_day_7`

### B) Define launch-state constants and naming
- Add explicit shared constants for:
  - launch wedge language
  - activation event key
  - first-week success metric names
- Keep this in one domain module to prevent drift across UI/API docs.

### C) Add milestone vocabulary (without changing UX yet)
- Add onboarding milestone enum/type that future Phase 1 code will use:
  - `fast_path_started`
  - `first_day_ready`
  - `household_defaults_completed`
  - `week_ready`

### D) Documentation consistency updates
- Keep `path_to_activation_launch` docs and any implementation ticket docs aligned with these final labels.
- Ensure checklist terms match event names used in instrumentation code.

## 3.3 Phase 0 Exit Checks
- Event names are locked and typed.
- Milestone state names are locked.
- Deferrals are explicit and referenced.
- No duplicate activation definitions across docs/modules.

---

## 4) Phase 1 — Execution Plan

## 4.1 Target Experience

Fast path sequence:
1. Add learner name (required).
2. Choose intake route using parent-facing labels.
3. Provide one meaningful source input.
4. Generate (Today-only or short horizon based on confidence).
5. Land in `Today` quickly.
6. Prompt optional refinement later.

## 4.2 Frontend Workstream

### A) Replace one-pass onboarding UI with progressive steps
- Refactor onboarding form into a step controller:
  - Step 1: learner capture
  - Step 2: intake route selection
  - Step 3: source capture
  - Step 4: generation/progress
  - Step 5: Today handoff
  - Step 6: optional refinement prompt

### B) Parent-facing intake copy
- Replace internal labels with:
  - “I have a book or curriculum”
  - “I have an outline or weekly plan”
  - “Start from a topic”
  - “Add another learner later”

### C) Add “Use this for just today” option
- Add horizon intent selector with “Just today” as explicit fast-path option.
- Keep post-generation suggestion to expand horizon later.

### D) Add preview gate for low/moderate confidence only
- Lightweight preview before save when confidence threshold is below configured cutoff.
- Preview includes learner target, title, detected chunks, and planned horizon.

### E) Mobile-first behavior
- Ensure each step is readable and actionable at phone width.
- Preserve generation state UX through slow async operations and reloads.

## 4.3 Backend / Domain Workstream

### A) Split onboarding completion into milestones
- Replace monolithic “complete/incomplete” assumption with milestone updates:
  - Mark `fast_path_started` on first onboarding interaction.
  - Mark `first_day_ready` once usable Today exists.
  - Mark `household_defaults_completed` after optional defaults are saved.
  - Mark `week_ready` when a stable week horizon exists.

### B) Separate minimum input contract from full household defaults
- Introduce fast-path payload schema with minimum required fields:
  - organizationId
  - learnerName
  - intakeType
  - sourceInput
  - optional horizon intent (`today_only` / `auto`)
- Move non-blocking defaults to a later refinement endpoint.

### C) Preserve source lineage + confidence metadata
- Persist per-intake metadata:
  - source type
  - raw input pointer/content (within storage policy)
  - learner target
  - confidence level
  - selected/derived planning horizon

### D) Idempotent post-activation refinement
- Add or adapt endpoint(s) so household defaults can be saved in multiple passes.
- Repeated submissions should update safely without breaking existing learner/planning state.

### E) Keep auth/session model unchanged
- Continue using existing SSR auth and workspace membership resolution.
- No alternative identity path and no bypass of workspace cookie context.

## 4.4 API and Service Sequencing

1. Add fast-path request/response schema + service method.
2. Add milestone update helpers in onboarding domain service.
3. Add preview evaluation endpoint/method (if confidence requires confirmation).
4. Add deferred household defaults endpoint/method.
5. Update `/onboarding` route behavior to route users by milestone status.
6. Keep redirect target defaulted to `/today` after first usable generation.

## 4.5 Analytics and Funnel Observability

- Emit events per onboarding step boundary.
- Add duration measurement: sign-up complete -> first Today opened.
- Add funnel snapshots for:
  - started -> learner entered
  - learner entered -> intake submitted
  - intake submitted -> generation completed
  - generation completed -> first Today opened
- Add explicit abandonment event for exits before first Today.

## 4.6 QA Plan (Phase 1)

Required manual scenarios:
1. Fresh account -> learner name + one input -> Today.
2. Same on phone width.
3. Low-confidence input path triggers preview and succeeds.
4. Generation failure and retry path preserves context.
5. Refresh during generation and resume safely.
6. Add second learner after first Today (without forced full setup).
7. Optional defaults completion later remains idempotent.

---

## 5) Suggested Delivery Slices

## Slice A (Phase 0 lock)
- Event contract types
- Milestone enum/types
- Docs synchronization

## Slice B (Phase 1 foundation)
- Fast-path schema/service + milestone persistence
- Step-based onboarding shell (minimal UI)

## Slice C (Phase 1 activation UX)
- Intake labels + source capture + generation state UX
- Today-first redirect and learner-context persistence

## Slice D (Phase 1 confidence + refinement)
- Preview for low/moderate confidence
- Post-activation defaults/refinement flow

## Slice E (Phase 1 instrumentation + QA)
- Funnel analytics + timing metrics
- Manual QA pass and bug fixes

---

## 6) Risks and Mitigations

- **Risk:** Breaking existing onboarding completeness assumptions.
  - **Mitigation:** Keep compatibility mapping from old complete flag to new milestone model.

- **Risk:** Slow generation increases early drop-off.
  - **Mitigation:** Add durable generation progress/resume UI and clear retry paths.

- **Risk:** Data quality regressions from minimal input.
  - **Mitigation:** Confidence scoring + bounded horizon policy + preview on low confidence.

- **Risk:** Multi-learner complexity reintroduces setup friction.
  - **Mitigation:** Only require one learner for activation; defer additional learners.

---

## 7) Definition of Done

## Phase 0 Done
- Activation + retention events locked and implemented as typed contracts.
- Onboarding milestones defined and reusable.
- Deferrals and surface commitments documented consistently.

## Phase 1 Done
- User reaches Today with one learner name + one meaningful input.
- Full household defaults are no longer required before first value.
- Milestone state is persisted and queryable.
- Funnel analytics identify step-level drop-off.
- Mobile fast path is validated and stable.

---

## 8) Implementation Notes for Ticket Creation

When creating tickets, attach this plan and tag work by stream:
- `activation-phase0/instrumentation`
- `activation-phase1/frontend`
- `activation-phase1/backend`
- `activation-phase1/analytics`
- `activation-phase1/qa`

Each ticket should include:
- impacted route(s)
- impacted service(s)
- milestone transition(s)
- event(s) emitted
- rollback plan
