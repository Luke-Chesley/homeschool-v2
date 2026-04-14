# Phase 3: Multi-Learner Household Implementation

## Purpose

This document turns Phase 3 from a product direction into implementation work tied to the current repo.

Phase 1 and Phase 2 already establish:

- a fast path to first learner activation
- an active learner cookie and session model
- learner-scoped planning, curriculum, tracking, and activity services
- a lightweight `/users` surface for creating and selecting learners

That gives the app the raw ingredients for multi-learner households.
It does not yet make multi-learner use feel intentional, obvious, or launch-ready.

Phase 3 exists to make the family account first-class while preserving one active learner at a time as the operating model.

## Current State

The repo already has a strong single-active-learner foundation:

- `lib/app-session/server.ts` resolves one active learner from `APP_LEARNER_COOKIE`
- `app/api/app-session/route.ts` already supports switching the active learner by updating workspace cookies
- `app/api/users/route.ts` already supports lightweight learner creation and sets the new learner active
- `app/users/page.tsx` and `components/users/user-manager.tsx` already expose a basic learner manager
- most parent routes already scope their work through `session.activeLearner.id`
- the global shell in `components/navigation/global-page-tabs.tsx` already shows the active learner name in workspace mode

That means the app is structurally closer to Phase 3 than the plan language alone suggests.

Current gaps:

- learner switching is tucked away in `/users`, not integrated into the parent workspace shell
- `/account` does not yet behave as a true household-management surface for multiple learners
- learner creation only captures `displayName`, with no explicit post-activation path for “add another learner from current household context”
- the app has no explicit multi-learner QA contract for Today, Planning, Curriculum, Tracking, and Copilot isolation
- analytics for second-learner creation and learner switching are not yet defined
- the billing-facing learner cap assumptions are not yet written into the implementation contract

## Phase 3 Outcome

At the end of this phase:

- the household account is the top-level container
- one learner stays active at a time in the parent workspace
- learner switching is available from the main parent shell in one or two taps
- adding a second learner feels like a natural next step after first activation
- learner-scoped product areas remain isolated and trustworthy
- account and billing assumptions describe the household clearly

## Scope

### In Scope

- shell-level active learner switching
- household learner management in `/account` and `/users`
- post-activation add-learner flow
- clear active learner state across parent routes
- QA and analytics for switching and per-learner isolation
- launch billing assumptions for learner caps

### Out Of Scope

- merged cross-learner planning views
- simultaneous multi-learner Today
- classroom, co-op, or staff admin roles
- real-time collaborative editing
- advanced cross-learner scheduling optimization

## Product Decisions To Lock

### One Active Learner At A Time

Do not build a family dashboard that tries to show every learner’s active day at once.

For launch:

- the account owns multiple learners
- the parent workspace acts on one learner at a time
- switching learners should be easy
- cross-learner comparison remains secondary

### “Add Learner” Is A Post-Activation Action

The first learner should still activate the household.

The second learner should be added from:

- `/account`
- `/users`
- a quiet CTA from `/today` after first activation

Do not reintroduce all-household setup before value.

### Account Is The Household Surface

`/account` should become the durable home for:

- household summary
- learner roster
- active learner context
- future billing summary

`/users` can remain the focused learner-management route, but it should feel like a sub-workspace of the household account model, not a disconnected system page.

## Existing Repo Seams To Use

### Workspace Session

Primary files:

- `lib/app-session/server.ts`
- `app/api/app-session/route.ts`
- `app/api/users/route.ts`

Current reality:

- the learner cookie model already supports switching
- session resolution already exposes `session.learners` and `session.activeLearner`
- route protection already handles the “no learner selected” case

Phase 3 should build on this model, not replace it.

### Learner Management UI

Primary files:

- `app/users/page.tsx`
- `components/users/user-manager.tsx`
- `app/(parent)/account/page.tsx`

Current reality:

- the learner manager already supports create + select
- account currently only displays the active learner rather than a real household learner roster

### Parent Shell

Primary files:

- `components/navigation/global-page-tabs.tsx`
- `app/(parent)/layout.tsx`

Current reality:

- the shell already knows whether it is in workspace mode
- it already fetches `/api/app-session`
- it already shows the active learner name in the workspace breadcrumb

Phase 3 should add switching here instead of inventing a second shell pattern.

## Implementation Strategy

### Workstream 1: Canonical Household Model In UI

Make the household model explicit in account and learner management surfaces.

Primary files:

- `app/(parent)/account/page.tsx`
- `app/users/page.tsx`
- `components/users/user-manager.tsx`

Required behavior:

- `/account` shows learner roster summary, active learner, and household-level controls
- `/users` remains the focused management route for selection and creation
- the account surface links clearly into learner management without making it the only place multi-learner state is visible

Implementation notes:

- keep cards plain and operational
- avoid a KPI dashboard or multi-learner analytics wall
- optimize for quick switching and adding, not for management theatrics

### Workstream 2: Shell-Level Learner Switching

Add a real active learner switcher to the parent workspace chrome.

Primary files:

- `components/navigation/global-page-tabs.tsx`
- optionally a new component under `components/navigation/` or `components/users/`
- `app/api/app-session/route.ts`

Required behavior:

- the active learner can be switched in one or two taps from workspace pages
- the switcher works on phone and desktop
- switching refreshes the current route into the selected learner’s workspace context
- if the new learner has no curriculum or planning state yet, the route should fail softly and guide the parent to the right next step

Rules:

- keep the switcher quiet
- do not add a large persistent learner sidebar
- use the existing session API instead of inventing a second selection mechanism

### Workstream 3: Post-Activation “Add Learner” Flow

Create a clear path for adding a second learner after the first learner reaches Today.

Primary files:

- `components/users/user-manager.tsx`
- `app/(parent)/account/page.tsx`
- `app/(parent)/today/page.tsx` or a small learner CTA component if appropriate
- `app/api/users/route.ts`
- `lib/users/service.ts`

Current baseline:

- `POST /api/users` creates a learner with only `displayName` and makes that learner active

Phase 3 should extend this into a clearer launch flow:

- add learner from household context
- optionally keep the new learner active immediately after creation
- optionally choose a starting route:
  - new input
  - starter shell
  - finish later

Recommended launch-safe scope:

- keep initial creation lightweight
- add one follow-up choice after creation instead of adding a large pre-submit form

### Workstream 4: Per-Learner Isolation Verification

Document and test the isolation contract across parent features.

Primary areas:

- Today
- Planning
- Curriculum
- Tracking
- Copilot
- learner activities / evidence

Phase 3 should define the minimum per-learner isolation contract:

- each learner has an independent live curriculum source
- weekly routes are learner-scoped
- today workspace plans are learner-scoped
- progress, attendance, evidence, and reports remain learner-scoped
- Copilot context follows the active learner

This work is partly implementation review and partly QA proof.

### Workstream 5: Session And Cookie Hardening

Harden edge cases around active learner selection.

Primary files:

- `lib/app-session/server.ts`
- `app/api/app-session/route.ts`
- `lib/users/service.ts`

Required checks:

- stale learner cookie for deleted or inactive learner
- learner cookie pointing at another organization
- no active learner after creating a new household
- switching to a learner with incomplete setup

Recommended behavior:

- if the cookie is invalid, fall back to the first available learner or null
- never let a bad learner cookie break the whole parent workspace
- keep API responses explicit enough for the shell to recover cleanly

### Workstream 6: Analytics And Billing Alignment

Add the launch metrics and billing assumptions Phase 3 depends on.

Primary files:

- `lib/platform/observability.ts`
- `lib/homeschool/onboarding/activation-contracts.ts` or adjacent event contract files
- `/account` copy and plan placeholders where needed

Track at minimum:

- `second_learner_created`
- `active_learner_switched`
- `active_learner_switch_failed`
- `new_learner_started_from_today`
- `new_learner_started_from_account`

Billing assumptions to write explicitly:

- one paying household
- learner cap enforced at account/billing layer later
- no per-seat enterprise model for v1

Phase 3 does not need to implement billing, but it must produce a model billing can attach to.

## Recommended API Shape

### Existing APIs To Reuse

- `GET /api/app-session`
- `POST /api/app-session`
- `POST /api/users`

### Recommended Additions

If needed, add explicit learner-management endpoints instead of overloading session APIs:

- `PATCH /api/users/[learnerId]` for lightweight learner edits
- `POST /api/users/[learnerId]/activate` as a semantic alias for learner switching if UI code benefits from a clearer route

Do not add more endpoints unless the current `app-session` and `users` APIs become meaningfully strained.

## UX Guidance

### Account

`/account` should evolve from summary copy into a usable household surface:

- learner roster cards
- visible active learner state
- add learner CTA
- manage learners CTA
- future billing placeholder that already speaks in household terms

### Users

`/users` should remain the focused workspace for:

- selecting the active learner
- creating a learner
- eventually editing lightweight learner details

### Today

Today should not become a family dashboard.

Allowed:

- small “add learner” CTA after activation
- small “switch learner” affordance in shell

Not allowed:

- stacked cross-learner overview cards
- dashboard filler
- right-rail household summary panels

## QA Matrix

### Household Activation Checks

- first learner activates the household without requiring a second learner
- second learner can be added after first activation
- new learner can remain the active learner immediately after creation

### Shell Switching Checks

- switching learners from the parent shell updates Today
- switching learners from the parent shell updates Planning
- switching learners from the parent shell updates Curriculum
- switching learners from the parent shell updates Tracking
- switching learners from the parent shell updates Copilot context

### Isolation Checks

- learner A progress does not appear under learner B
- learner A evidence does not appear under learner B
- learner A curriculum source state does not overwrite learner B
- learner A weekly route changes do not alter learner B

### Recovery Checks

- stale learner cookie falls back cleanly
- switching to a learner with no ready curriculum does not hard-crash the route
- refreshing after a learner switch preserves the selected learner

### Mobile Checks

- shell switcher is usable at phone width
- adding a learner from account/users works at phone width
- switching learners on Today does not create cramped or confusing controls

## Rollout Order

1. write the household and active-learner implementation contract
2. harden session fallback behavior
3. improve `/account` into a real household surface
4. add shell-level learner switching
5. refine post-activation add-learner flow
6. run per-learner isolation QA across parent surfaces
7. align billing assumptions and account copy

## Exit Criteria

Phase 3 is complete when:

- the household is explicit as the account-level unit
- the active learner can be switched quickly from the main parent workspace
- a second learner can be added without disturbing the first learner activation flow
- per-learner state remains isolated across Today, Planning, Curriculum, Tracking, and Copilot
- the account surface describes the household clearly enough for later billing work

## Recommended First PR Slice

The first implementation PR for Phase 3 should stay narrow:

1. harden active learner session fallback behavior
2. add a quiet shell-level learner switcher
3. upgrade `/account` to show learner roster and active learner state
4. add analytics for learner switching

Do not mix learner profile editing, billing UI, and large account-surface expansion into that first PR.
