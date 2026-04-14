# Phase 1: Fast-Path Onboarding Checklist

## Product Decisions

- [ ] Lock the first-session activation event.
- [ ] Lock the minimum required fields for fast path.
- [ ] Decide whether preview is always shown or only for low-confidence intake.
- [ ] Decide whether fast path lands on Today immediately or on a preview confirmation step first.
- [ ] Decide where optional household refinement lives after activation.

## UX And Copy

- [ ] Replace internal intake labels with parent-facing language.
- [ ] Remove long explainer blocks from the first screen.
- [ ] Make learner name the first field.
- [ ] Add an obvious "teach from what I have today" option.
- [ ] Add concise empty, loading, and generation states.
- [ ] Add post-generation refinement prompts that do not feel mandatory.

## Frontend

- [ ] Break the current onboarding form into progressive steps.
- [ ] Preserve multi-learner support without forcing all learners to be configured immediately.
- [ ] Make the fast path work cleanly on phone widths.
- [ ] Add generation progress UI that survives slower AI work.
- [ ] Redirect to Today or preview without losing active learner context.

## Backend And Domain

- [ ] Introduce explicit onboarding state milestones beyond a single complete / incomplete flag.
- [ ] Allow partial organization setup during fast path.
- [ ] Allow generation to run without full household defaults.
- [ ] Preserve intake source lineage and confidence metadata.
- [ ] Keep later household refinement idempotent.

## Instrumentation

- [ ] Track each onboarding step.
- [ ] Track time to first Today.
- [ ] Track fast-path abandon rate.
- [ ] Track whether users complete later household refinement.

## QA

- [ ] Fresh account to Today for one learner.
- [ ] Fresh account to Today on phone width.
- [ ] Add second learner after first Today.
- [ ] Retry after failed generation.
- [ ] Resume after refresh or navigation interruption.
- [ ] Verify no auth / workspace cookie regressions.
