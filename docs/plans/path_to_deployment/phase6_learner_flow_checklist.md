# Phase 6: Learner Flow Redesign Checklist

Use this alongside [phase6_learner_flow_redesign.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_flow_redesign.md) and [phase6_learner_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_surface_inventory.md).

This is the execution tracker for the learner-facing redesign pass.

## Status

- [x] Phase 6 planning started
- [ ] Phase 6 implementation started
- [ ] Phase 6 reviewed on staging
- [ ] Phase 6 merged to `main`

## Slice 1: Direction Lock

- [ ] Reconfirm that learner surfaces should extend the Phase 5 product language rather than invent a new one.
- [ ] Lock the learner target feel as calm, premium, focused, and mobile-ready.
- [ ] Confirm the learner queue and activity runtime are the two primary surfaces for this phase.
- [ ] Confirm core logic, attempt flow, autosave, and submit behavior stay intact.
- [ ] Confirm studio diagnostics remain additive and secondary.

## Slice 2: Learner Shell

- [ ] Audit the current learner layout chrome, top bar, and navigation path back to the parent workspace.
- [ ] Reduce learner chrome to one compact, useful top bar.
- [ ] Make learner identity and route orientation clear without stacking extra headers.
- [ ] Keep studio access available without competing with primary learner actions.
- [ ] Verify the learner shell feels lighter than the parent shell while still belonging to the same product.

## Slice 3: Learner Home / Queue

- [ ] Redesign the learner home around a clearer daily queue.
- [ ] Tighten the page intro and remove explanatory copy that does not help the learner act.
- [ ] Clarify the hierarchy between in-progress, up-next, and done sections.
- [ ] Improve session card spacing, state cues, and touch targets.
- [ ] Make “resume” and “start” states more obvious without adding noise.
- [ ] Make the empty queue state feel intentional and calm.

## Slice 4: Parent Today To Learner Handoff

- [ ] Audit how learner activities are currently surfaced from the parent `Today` view.
- [ ] Make activity entry points from `Today` obvious and low-friction.
- [ ] Align parent `Today` language with learner queue and runtime language.
- [ ] Ensure learner work feels like the continuation of the day’s plan rather than a hidden separate area.

## Slice 5: Activity Reading Surface

- [ ] Redesign the learner activity page around a stronger reading surface.
- [ ] Reduce shell weight around the activity itself.
- [ ] Improve instruction, example, and response spacing.
- [ ] Keep back navigation available but visually quiet.
- [ ] Improve the relationship between working state, submit state, and completion state.
- [ ] Ensure the activity runtime does not feel like a generic form renderer.

## Slice 6: Shared Learner Interaction Patterns

- [ ] Standardize learner loading states.
- [ ] Standardize learner error and recovery states.
- [ ] Standardize submit and completion patterns.
- [ ] Standardize touch-friendly button sizing and action spacing.
- [ ] Standardize any learner-facing callouts, hints, and secondary notes.

## Slice 7: Studio Boundary Review

- [ ] Move any remaining learner runtime diagnostics fully behind studio mode.
- [ ] Confirm no raw payloads or trace language remain in product mode.
- [ ] Verify the runtime diagnostics drawer still gives enough operator visibility.
- [ ] Confirm studio mode does not structurally distort learner layouts.

## Slice 8: Responsive QA

- [ ] Verify `/learner` at common laptop widths.
- [ ] Verify `/learner` at tablet widths.
- [ ] Verify parent `Today` makes learner activity access obvious at common laptop widths.
- [ ] Verify `/activity/[sessionId]` at common laptop widths.
- [ ] Verify `/activity/[sessionId]` at tablet widths.
- [ ] Verify the core learner flow at a narrow phone width.
- [ ] Verify touch targets, sticky controls, and submit actions feel comfortable.

## Docs And Tracking

- [ ] Update [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) as Phase 6 starts and finishes.
- [ ] Keep [phase6_learner_flow_redesign.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_flow_redesign.md) current if implementation decisions change.
- [ ] Keep [phase6_learner_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_surface_inventory.md) current if learner scope changes.
- [ ] Record any deferrals before moving to the next phase.

## Exit Criteria

- [ ] The learner shell feels quieter and lighter than the parent shell.
- [ ] The learner home reads clearly as a daily queue.
- [ ] Parent `Today` clearly hands off into learner activity work.
- [ ] Activity runtime feels focused, readable, and touch-friendly.
- [ ] Product mode is free of runtime diagnostics and debug clutter.
- [ ] Studio diagnostics remain easy to reach.
- [ ] Learner routes feel like the same product family as the Phase 5 parent redesign.
