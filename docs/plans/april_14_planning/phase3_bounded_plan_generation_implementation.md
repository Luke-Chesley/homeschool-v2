# Phase 3 Implementation

## Goal

Generate the smallest durable planning artifact that the app can persist and schedule without pretending it already has a full curriculum.

## Current Fit With Repo

- `homeschool-v2` already knows how to import a structured curriculum document into `curriculum_sources`, `curriculum_nodes`, and weekly route state.
- `getOrCreateWeeklyRouteBoardForLearner` and `getTodayWorkspace` already consume curriculum-backed route trees once a source exists.
- Fast-path onboarding currently persists either a manual shell or an outline import, but those are stand-ins rather than a bounded AI plan shaped to the interpreted source.
- `learning-core` now owns `source_interpret`, which gives Phase 3 a clean bounded input contract.

## Implementation Decision

Phase 3 uses `curriculum_generate` in source-entry mode and makes fast-path onboarding persist its result as a curriculum source.

That means the app will not invent a separate temporary plan table for launch. Instead, it will:

- generate a bounded imported-document shape
- import it through the existing curriculum pipeline
- mark the source as bounded/provisional in metadata
- keep expansion explicit for later phases

## Scope

### learning-core

- add the source-entry `CurriculumGenerationRequest`
- add `launchPlan` to the curriculum artifact
- route source-first creation through `curriculum_generate`
- generate:
  - bounded `document`
  - bounded `units`
  - optional progression metadata
  - rationale and session-minute guidance
- constrain scope by horizon:
  - `today`
  - `tomorrow`
  - `next_few_days`
  - `current_week`
  - `starter_module`

### homeschool-v2

- call `curriculum_generate` through the curriculum client
- convert curriculum artifacts into `ImportedCurriculumDocument`
- replace fast-path curriculum initialization with curriculum import
- persist source metadata that marks:
  - requested route
  - routed route
  - source kind
  - bounded horizon
  - provisional / reversible status
- keep full onboarding and larger curriculum flows unchanged

## Persistence Strategy

Use existing curriculum persistence rather than a separate launch-only plan store.

- `curriculum_sources` remains the durable source record
- `curriculum_nodes` remains the route-generation input
- weekly route generation remains unchanged
- source metadata carries the “bounded” contract so later phases can expand explicitly instead of overwriting silently

## Implementation Notes

- fast-path onboarding should call `curriculum_generate` after learner creation and before weekly route generation
- the imported document should stay intentionally small; one weak source should not explode into a full tree
- `single_day_material` should generally become one to two lessons
- `weekly_assignments` should generate only the current week
- `topic_seed` should generate a small starter module, not a semester map
- `CurriculumSourceIntakeSchema` should expose the richer Phase 2 intake metadata so downstream surfaces can read it without reaching into raw metadata

## Exit Criteria

- one photographed or typed day can become a bounded imported source
- weekly inputs generate a current-week route without full curriculum generation
- topic inputs generate a small starter module
- fast-path onboarding persists a provisional source that route generation can consume
