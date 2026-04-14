# Phase 4: Mobile-First Parent Runtime Implementation

## Purpose

This document turns Phase 4 from a launch principle into implementation work tied to the current repo.

The repo already ships as responsive web and already has:

- fast-path onboarding with progressive steps
- a parent shell with mobile topbar + drawer navigation
- learner switching in the workspace shell
- a functional Today runtime with completion actions
- storage, evidence, and file-upload building blocks in adjacent systems

That is enough to say mobile is possible.
It is not enough to say the parent runtime is launch-ready on a phone.

Phase 4 exists to make the core parent workflow dependable at phone width:

- capture input
- reach Today
- run the day
- mark progress
- switch learners
- attach evidence
- recover from slow or interrupted generation

## Current State

The current codebase already gives us a partial Phase 4 foundation:

- `components/onboarding/homeschool-onboarding-form.tsx` is already step-based and reasonably compact
- `components/parent-shell/parent-topbar.tsx` already has a mobile-specific topbar
- `components/parent-shell/parent-shell.tsx` already has a mobile drawer navigation pattern
- `components/navigation/global-page-tabs.tsx` and `components/users/active-learner-switcher.tsx` now expose learner context and switching
- `app/(parent)/today/page.tsx` and `components/planning/today-workspace-view.tsx` already centralize the core parent runtime
- `lib/planning/today-service.ts` already supports done / partial / skipped / moved state transitions

Current gaps:

- Today still presents a lot of simultaneous surface area for phone width
- parent actions are available on phone, but not yet explicitly designed around one-thumb or narrow viewport behavior
- onboarding does not yet include upload / camera-friendly intake in the main path
- evidence capture is present in lower-level systems, but not surfaced as a coherent parent-phone workflow
- generation and retry states are readable, but not yet defined as a durable leave-and-return mobile contract
- the repo has no explicit Phase 4 QA matrix tied to phone-specific parent runtime flows

## Phase 4 Outcome

At the end of this phase:

- onboarding is comfortable on phone for learner, route, source, preview, and generation
- Today is usable on phone without desktop assumptions
- progress actions are tap-friendly and understandable on small screens
- learner switching works cleanly on phone within the parent runtime
- evidence capture supports photo-first parent use
- slow or interrupted generation states recover clearly on phone

## Scope

### In Scope

- parent runtime at phone widths
- onboarding mobile ergonomics
- Today mobile ergonomics
- learner switching on phone
- mobile evidence capture entry points
- generation loading / retry / recovery states
- phone-width QA and verification

### Out Of Scope

- native app packaging
- push notifications
- full offline-first behavior
- advanced background sync
- device-native capture pipelines beyond browser capabilities

## Product Decisions To Lock

### Responsive Web Is The Shipping Surface

Phase 4 should continue to assume:

- responsive web is the launch surface
- PWA polish is optional and additive
- native app work remains deferred

Do not let “mobile-first” turn into “start a native app plan.”

### Today Must Remain The Parent Center

On phone, the parent should still orient around Today first.

That means:

- the current item must stay obvious
- the primary next action must stay local
- secondary panels should collapse or sequence behind the main action

Do not build a phone dashboard.

### Evidence Capture Must Feel Like Part Of The Day

Evidence capture should attach to the current learner workflow, not live as a detached tracking tool.

Launch behavior should allow:

- taking or uploading a photo
- adding a short note
- associating it with a session, item, or current learning record

## Existing Repo Seams To Use

### Onboarding

Primary files:

- `components/onboarding/homeschool-onboarding-form.tsx`
- `app/onboarding/page.tsx`
- `app/api/homeschool/onboarding/route.ts`
- `lib/homeschool/onboarding/service.ts`

Current reality:

- Phase 1 and 2 already produced a compact onboarding flow
- route selection, source text, preview, and generation are already in one component

Phase 4 should improve mobile ergonomics here rather than redesign the flow again.

### Parent Shell

Primary files:

- `components/parent-shell/parent-shell.tsx`
- `components/parent-shell/parent-topbar.tsx`
- `components/parent-shell/parent-sidebar.tsx`
- `components/navigation/global-page-tabs.tsx`

Current reality:

- there is already a mobile topbar and drawer
- learner switching already exists in the global tabs context, but not yet intentionally designed as a phone-first control inside the parent runtime

### Today Runtime

Primary files:

- `app/(parent)/today/page.tsx`
- `components/planning/today-workspace-view.tsx`
- `app/(parent)/today/actions.ts`
- `lib/planning/today-service.ts`

Current reality:

- Today is the core parent runtime
- action handlers already exist
- the current UI is capable, but dense for narrow widths

### Evidence / Upload / Storage

Primary files and seams:

- `lib/storage/*`
- `lib/db/schema/workflow.ts`
- `lib/db/repositories/tracking.ts`
- `lib/session-workspace/service.ts`
- `components/activities/v2/EvidenceCaptureComponents.tsx`
- `components/curriculum/AddSourceModal.tsx`

Current reality:

- evidence records and storage paths exist
- upload-related UI exists in component-level or curriculum-level seams
- parent-facing phone evidence flow is not yet unified

## Implementation Strategy

### Workstream 1: Mobile Audit And Layout Contract

Write and enforce a narrow viewport contract for parent runtime surfaces.

Primary targets:

- onboarding
- parent shell
- Today
- learner switching
- evidence entry points

Define target widths for QA:

- `390px` width as the default phone target
- `430px` width as larger phone target
- `768px` width as tablet boundary

Rules:

- no horizontal overflow
- no action rows that require side-scrolling
- no hidden critical action behind desktop-only hover or disclosure patterns

### Workstream 2: Onboarding Phone Ergonomics

Improve the existing fast path for phone, not by changing the model, but by reducing friction.

Primary files:

- `components/onboarding/homeschool-onboarding-form.tsx`
- `app/onboarding/page.tsx`

Required behavior:

- step cards read comfortably at phone width
- route options remain tap-friendly
- source input is comfortable for mobile paste and short typed notes
- preview remains readable without dense stacked form controls
- generation state stays visible and understandable without scrolling confusion

Recommended changes:

- tighten spacing and control ordering for phone
- ensure primary CTA placement is consistent
- make phone copy slightly shorter where necessary

### Workstream 3: Today Phone Ergonomics

Make Today function as a focused parent runtime on phone.

Primary files:

- `components/planning/today-workspace-view.tsx`
- `app/(parent)/today/page.tsx`
- `components/planning/lesson-plan-panel.tsx`
- `components/planning/lesson-draft-renderer.tsx`

Required behavior:

- the lead item is obvious on first view
- action buttons for done / partial / skipped / moved are easy to reach and understand
- lesson draft content does not crowd out the current item
- secondary metadata stays subordinate on phone
- the learner handoff action remains discoverable but quiet

Recommended UI approach:

- stack major sections in a deliberate order
- collapse secondary content by default where appropriate
- keep one clear current action visible above the fold

### Workstream 4: Learner Switching On Phone

Make learner switching practical inside the parent runtime at phone width.

Primary files:

- `components/navigation/global-page-tabs.tsx`
- `components/parent-shell/parent-topbar.tsx`
- `components/users/active-learner-switcher.tsx`

Required behavior:

- a parent can confirm the active learner quickly
- a parent can switch learners without opening a full management page
- switching on phone does not create a cluttered header

Recommended implementation:

- keep the existing desktop switcher in global tabs
- expose a mobile-appropriate learner switch affordance in the topbar or drawer
- do not duplicate multiple competing switchers on the same viewport

### Workstream 5: Evidence Capture Entry Point

Add a coherent parent-facing evidence capture path that works on phone.

Primary files:

- likely a new parent runtime component under `components/planning/` or `components/tracking/`
- `app/(parent)/today/actions.ts` or adjacent parent runtime API surface
- `lib/session-workspace/service.ts`
- `lib/db/repositories/tracking.ts`
- `lib/storage/*`

Launch-safe minimum:

- attach a note and optional photo/file to the current session or plan item
- surface upload progress and completion clearly
- allow browser camera capture where available through file input behavior

Important constraint:

- Phase 4 does not need perfect evidence taxonomy
- it needs a trustworthy parent workflow for “capture what happened on my phone”

### Workstream 6: Generation Recovery States

Define and harden the mobile contract for slower generation.

Primary files:

- `components/onboarding/homeschool-onboarding-form.tsx`
- curriculum generation surfaces if they remain parent-facing
- any supporting API response contracts

Required behavior:

- loading states remain understandable on small screens
- retry is explicit when generation fails
- refresh or route interruption does not create impossible-to-interpret state
- parent can leave and return without feeling the action vanished

Recommended launch-safe approach:

- persist generation summary and last known state in lightweight metadata where useful
- avoid long blocking states without explanatory copy
- make the next safe action obvious: retry, edit source, or continue

### Workstream 7: Optional PWA Polish

Treat this as the last step, not the first.

Possible scope:

- installable metadata check
- icon polish
- splash / theme-color sanity

Only do this after the actual parent runtime feels strong on phone.

## Recommended API And Data Guidance

### Do Not Invent A Separate Mobile Backend

Use the same core domain services and APIs:

- onboarding API
- app-session switching
- today actions
- tracking / evidence repositories

Mobile-first should mostly mean UI behavior and recovery semantics, not a second stack.

### Evidence Capture Contract

The Phase 4 implementation should define a minimum evidence payload:

- `organizationId`
- `learnerId`
- `lessonSessionId` or `planItemId`
- `note`
- `storagePath` or uploaded asset reference
- `evidenceType`

This can ride on existing evidence record structures rather than inventing a new store.

## UX Guidance

### Phone Hierarchy

For parent runtime screens:

- one strong primary section
- one clear next action
- one compact way to switch learner

Avoid:

- multiple equal-weight cards above the fold
- large empty headers
- duplicated action sets

### Tap Targets

Phone actions should be:

- easily thumbable
- clearly labeled
- spaced enough to avoid accidental taps

### Copy

On phone, copy should be even tighter than desktop:

- direct labels
- short recovery messages
- no explanatory filler

## QA Matrix

### Onboarding

- create household, sign in, and reach onboarding on phone width
- select route and submit source on phone width
- review preview and continue on phone width
- verify no overflow, clipped CTA, or stacked-control confusion

### Today

- open Today on phone width
- mark done / partial / skipped / moved on phone width
- open lesson draft and learner activity from phone width
- confirm lead item remains obvious without excessive scrolling

### Learner Switching

- switch learners from phone-width parent runtime
- verify Today updates to the selected learner
- verify refresh preserves the learner selection

### Evidence

- attach note-only evidence from phone width
- attach photo/file evidence from phone width
- confirm upload completion feedback is visible

### Recovery

- fail generation and verify retry path is clear
- reload during in-progress generation and verify the UI remains understandable
- use a slower connection simulation where possible

## Rollout Order

1. write the mobile runtime contract and target widths
2. harden onboarding phone ergonomics
3. simplify Today phone layout and action behavior
4. add mobile learner switching affordance
5. implement evidence capture entry point
6. harden generation retry / recovery states
7. optionally add light PWA polish

## Exit Criteria

Phase 4 is complete when:

- a parent can activate from a phone without falling back to desktop
- Today is usable on phone for the actual daily loop
- learner switching works cleanly on phone
- evidence capture works credibly on phone
- slow or failed generation states remain recoverable on phone

## Recommended First PR Slice

The first implementation PR for Phase 4 should stay narrow:

1. mobile audit fixes for onboarding and Today
2. mobile learner switch affordance in the parent shell
3. phone-focused action spacing and hierarchy improvements

Do not mix evidence upload plumbing and optional PWA polish into that first PR.
