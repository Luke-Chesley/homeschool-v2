# Phase 2 Implementation

## Goal

Move source classification out of `homeschool-v2` heuristics and into a first-class `learning-core` operation so fast-path onboarding routes weak inputs conservatively and explicitly.

## Current Fit With Repo

- `lib/homeschool/onboarding/service.ts` currently infers confidence, horizon, assumptions, and route behavior entirely from local text-length heuristics.
- `learning-core` already exposes typed named operations through the shared operation envelope, so `source_interpret` fits the existing boundary.
- Fast-path onboarding still sends `single_lesson` and `weekly_plan` into `ai_decompose`, which means weak inputs can still trigger full curriculum generation.
- The new Phase 1 intake package layer already gives us a normalized text payload plus modality metadata, which is the right input to interpret.

## Implementation Decision

Phase 2 will do two things at once:

1. add a `source_interpret` operation in `learning-core`
2. replace fast-path onboarding heuristics with app-side routing policy built on the interpretation result

The app will still own routing policy. `learning-core` will classify and recommend, but it will not silently choose the final route.

## Scope

### learning-core

- add `SourceInterpretationRequest`
- add `SourceInterpretationArtifact`
- add `source_interpret` to the skill registry
- add a prompt that:
  - classifies source kind
  - recommends a bounded horizon
  - states assumptions
  - optionally asks for clarification
  - explicitly does not generate curriculum or lesson content
- add targeted tests for:
  - contract validation
  - prompt-preview constraints
  - execution validation

### homeschool-v2

- add a `lib/learning-core/source-interpret.ts` client
- add source-kind and interpretation contracts to onboarding types
- replace `buildFastPathPreview` heuristics with `source_interpret` + explicit routing policy
- make preview show:
  - requested route
  - detected source kind
  - routed fast-path mode
  - follow-up question when present
- persist interpretation metadata into fast-path intake metadata and onboarding milestones

### Fast-path Routing Policy

- `single_day_material` routes to `single_lesson`
- `weekly_assignments` routes to `weekly_plan`
- `sequence_outline` routes to `outline`
- `topic_seed` routes to `topic`
- `manual_shell` routes to `manual_shell`
- `ambiguous` forces confirmation and stays conservative

### Curriculum Mode Policy

Fast-path onboarding should stop using curriculum AI decomposition for weak launch inputs.

- `weekly_plan` and `outline` use `paste_outline`
- `single_lesson`, `topic`, and `manual_shell` use `manual_shell`

That keeps the path bounded until later phases introduce bounded plan generation and automatic Today generation.

## Implementation Notes

- `manual_shell` needs to become source-aware enough to preserve detected chunks and horizon instead of always generating a generic shell.
- horizon selection still respects the parent’s `today_only` override, but `auto` must clamp to the interpretation’s safe recommendation.
- mismatches between requested route and detected source kind should surface in preview rather than being hidden.
- no silent heuristic fallback if `learning-core` is unavailable; the operation boundary should fail loudly.

## Exit Criteria

- fast-path onboarding calls `source_interpret` before preview/finalization
- preview is driven by interpretation output instead of text-length heuristics
- `single_day_material` no longer routes through curriculum AI generation
- `weekly_assignments` and `topic_seed` stay distinct in policy and persisted metadata
- ambiguous cases request confirmation explicitly
