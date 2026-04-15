# Phase 4 Implementation

## Goal

Make the first lesson-draft build start automatically when fast-path onboarding lands in `Today`, instead of requiring a manual `Generate` click.

## Current Fit With Repo

- Fast-path onboarding already creates the learner, imports a bounded source, materializes the weekly route board, and redirects to `/today`.
- `getTodayWorkspace` already resolves the canonical route, syncs plan/session records, and loads a saved lesson draft when one exists.
- `app/api/ai/lesson-plan/route.ts` already knows how to build a lesson draft through `session_generate` and save it into the Today workspace.
- `LessonPlanPanel` is already the place where the parent sees draft state, prompt preview, and manual regenerate controls.

## Implementation Decision

Phase 4 will keep lesson generation in `homeschool-v2` and reuse the existing `session_generate` contract. The app will add a small persisted Today build state keyed by `date + sourceId + routeFingerprint`, queue that state during onboarding, and auto-start generation from the Today client on first arrival.

This keeps the learning-core contract stable for this phase. The app will pass richer intake context into `session_generate`, but Phase 4 does not need a new learning-core operation.

## Scope

### homeschool-v2

- add a persisted Today lesson-build state alongside saved Today lesson drafts
- queue the first Today lesson build at the end of fast-path onboarding
- factor lesson generation into a reusable service instead of keeping all logic inside the API route
- auto-start lesson generation from `Today` when the current route has a queued build
- add boot states for:
  - `queued`
  - `generating`
  - `failed`
  - `ready`
- hide the empty-state manual `Generate` CTA on first arrival while the build is queued or running
- keep manual regenerate and prompt-preview behavior for later edits
- track explicit lesson-build lifecycle events instead of overloading the earlier onboarding generation events

### learning-core

- no contract change required
- reuse `session_generate`
- pass richer context from the app:
  - requested route
  - routed route
  - source kind
  - chosen horizon
  - intake assumptions / detected chunks when available

## Persistence Strategy

Store Today lesson-build state in the existing Today workspace `plan_days.metadata` document next to `todayLessonDrafts`.

Why here:

- the state is already keyed to the learner’s Today workspace day
- it needs to survive redirects, refreshes, and hosted resumes
- it avoids introducing a new table for a narrow launch behavior

The state should be ignored when the route fingerprint changes, just like saved lesson drafts are ignored when they no longer match the active route.

## Build Contract

### Queue during onboarding

At the end of fast-path onboarding:

1. import the bounded source
2. materialize the weekly route
3. resolve Today workspace
4. write a queued lesson-build state for the current route fingerprint
5. redirect to `/today`

### Run from Today

On first Today render with no matching saved lesson draft:

1. show a clear boot state instead of the empty lesson-draft prompt
2. auto-start the build through a server action
3. transition persisted state from `queued` to `generating`
4. call `session_generate`
5. save the structured draft
6. transition state to `ready`
7. refresh the workspace

If generation fails:

- transition state to `failed`
- show the failure inline
- keep a clear retry action

## UI Contract

The first-arrival lesson panel should read like product behavior, not AI theater:

- queued: `Preparing your first lesson draft…`
- generating: `Building today’s lesson draft…`
- failed: inline failure with `Retry build`
- ready: normal lesson draft view with regenerate controls

The panel should still show route context and prompt preview in studio mode, but the default experience should emphasize that the draft is being prepared automatically.

## Exit Criteria

- fast-path onboarding queues the first lesson build automatically
- `Today` auto-starts lesson generation when the queued build is present
- first arrival does not show the empty `Generate a draft when today’s route is set.` state
- completed builds save a real lesson draft for the current route fingerprint
- failed builds are recoverable without leaving `Today`
