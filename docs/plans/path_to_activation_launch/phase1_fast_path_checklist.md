# Phase 1: Fast-Path Onboarding Checklist

## Product Decisions

- [x] Lock the first-session activation event.
- [x] Lock the minimum required fields for fast path.
- [x] Decide whether preview is always shown or only for low-confidence intake.
- [x] Decide whether fast path lands on Today immediately or on a preview confirmation step first.
- [x] Decide where optional household refinement lives after activation.

## UX And Copy

- [x] Replace internal intake labels with parent-facing language.
- [x] Remove long explainer blocks from the first screen.
- [x] Make learner name the first field.
- [x] Add an obvious "teach from what I have today" option.
- [x] Add concise empty, loading, and generation states.
- [x] Add post-generation refinement prompts that do not feel mandatory.

## Frontend

- [x] Break the current onboarding form into progressive steps.
- [x] Preserve multi-learner support without forcing all learners to be configured immediately.
- [x] Make the fast path work cleanly on phone widths.
- [x] Add generation progress UI that survives slower AI work.
- [x] Redirect to Today or preview without losing active learner context.

## Backend And Domain

- [x] Introduce explicit onboarding state milestones beyond a single complete / incomplete flag.
- [x] Allow partial organization setup during fast path.
- [x] Allow generation to run without full household defaults.
- [x] Preserve intake source lineage and confidence metadata.
- [x] Keep later household refinement idempotent.

## Instrumentation

- [x] Track each onboarding step.
- [x] Track time to first Today.
- [x] Track fast-path abandon rate.
- [x] Track whether users complete later household refinement.

## QA

- [x] Fresh account to Today for one learner.
- [x] Fresh account to Today on phone width.
- [x] Add second learner after first Today.
- [x] Retry after failed generation.
- [x] Resume after refresh or navigation interruption.
- [x] Verify no auth / workspace cookie regressions.
