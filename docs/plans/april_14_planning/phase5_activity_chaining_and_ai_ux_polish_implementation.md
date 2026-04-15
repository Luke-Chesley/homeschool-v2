# Phase 5 Implementation

## Goal

Turn the first generated lesson into a visible, guided AI-assisted day by chaining activity generation automatically and making regeneration controls feel intentional instead of manual tooling.

## Current Fit With Repo

- Phase 4 now queues and auto-builds the first lesson draft from `Today`.
- `publishActivityForLessonDraft` already owns the canonical one-activity-per-lesson-draft contract.
- `generateLessonDraftActivityAction` already exists, but it is still manual-first and the `Today` client does not load initial activity status from the server.
- `LessonPlanPanel` already owns the lesson regenerate action and is now the right place for a small parent context note.

## Implementation Decision

Phase 5 will mirror the lesson-build pattern for activity generation:

- persist a Today activity-build state keyed to the current route / draft
- queue activity generation automatically after lesson-draft success
- let the activity control auto-start when a queued build is present
- show generating / failed / stale states clearly

For lesson polish, Phase 5 will add a lightweight saved context note for “Add context and regenerate” and introduce persistent intent controls for `keep_today` vs `expand_from_here`.

Those intent controls are intentionally lighter than the real expansion engine. Phase 6 will read the stored intent and materialize bounded route expansion explicitly.

## Scope

### homeschool-v2

- add persisted Today activity-build state
- queue activity generation automatically after lesson build success
- auto-start activity generation from the `Today` client
- show:
  - `Building activity…`
  - `Activity ready`
  - `Activity stale`
  - `Retry build`
- load initial activity status from the server instead of relying on a null client default
- add a small parent context note field to lesson regeneration
- persist “keep this to today” and “expand from here” intent on the current route / day

### learning-core

- no required contract change
- reuse `activity_generate`
- keep contextual hints app-side for now unless evidence shows the core prompt needs extra launch-specific framing

## Persistence Strategy

- store Today activity-build state in `plan_days.metadata` beside the lesson-build state
- store regeneration context note in `plan_days.metadata` keyed to the active source + route fingerprint
- store expansion intent in the same day-scoped metadata so Phase 6 can read it without re-deriving parent intent from UI history

## UX Contract

### Activity chaining

After a lesson draft becomes ready:

1. queue activity generation automatically
2. show `Building activity…`
3. swap into `Open activity` when the build completes
4. show an inline retry state if the build fails

### Regeneration polish

The parent should be able to:

- leave a short note like “make this more hands-on” or “shorter, lower-friction”
- regenerate the lesson with that context
- immediately understand whether the existing activity is stale and needs regeneration

### Intent controls

- `Keep this to today` records that the parent wants to hold the scope at today only
- `Expand from here` records that the parent wants a larger bounded route when expansion tools are available

These are product-support controls, not final route-expansion mechanics. Phase 6 turns them into actual bounded expansion actions.

## Exit Criteria

- activity generation starts automatically after lesson success
- the parent no longer needs a separate first-click to get an activity
- activity stale / ready / failed states are visible and understandable
- the lesson panel supports a short context note before regenerate
- the parent can explicitly mark `keep_today` vs `expand_from_here` intent
