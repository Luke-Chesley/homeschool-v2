# Phase 6: Learner Flow Redesign Checklist

Use this alongside [phase6_learner_flow_redesign.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_flow_redesign.md) and [phase6_learner_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_surface_inventory.md).

This is the execution tracker for the learner-facing redesign pass.

## Status

- [x] Phase 6 planning started
- [x] Phase 6 implementation started
- [x] Phase 6 reviewed on staging/local responsive QA
- [x] Phase 6 merged to `main`
- [ ] Final Phase 6 signoff: verify one fully completed learner session state

## Slice 1: Direction Lock

- [x] Reconfirm that learner surfaces should extend the Phase 5 product language rather than invent a new one.
- [x] Lock the learner target feel as calm, premium, focused, and mobile-ready.
- [x] Confirm the learner queue and activity runtime are the two primary surfaces for this phase.
- [x] Confirm core logic, attempt flow, autosave, and submit behavior stay intact.
- [x] Confirm studio diagnostics remain additive and secondary.

## Slice 2: Learner Shell

- [x] Audit the current learner layout chrome, top bar, and navigation path back to the parent workspace.
- [x] Reduce learner chrome to one compact, useful top bar.
- [x] Make learner identity and route orientation clear without stacking extra headers.
- [x] Keep studio access available without competing with primary learner actions.
- [x] Verify the learner shell feels lighter than the parent shell while still belonging to the same product.

## Slice 3: Learner Home / Queue

- [x] Redesign the learner home around a clearer daily queue.
- [x] Tighten the page intro and remove explanatory copy that does not help the learner act.
- [ ] Clarify the hierarchy between in-progress, up-next, and done sections.
- [x] Improve session card spacing, state cues, and touch targets.
- [x] Make “resume” and “start” states more obvious without adding noise.
- [ ] Make the empty queue state feel intentional and calm.

## Slice 4: Parent Today To Learner Handoff

- [x] Audit how learner activities are currently surfaced from the parent `Today` view.
- [x] Make activity entry points from `Today` obvious and low-friction.
- [x] Align parent `Today` language with learner queue and runtime language.
- [x] Ensure learner work feels like the continuation of the day’s plan rather than a hidden separate area.

## Slice 5: Activity Reading Surface

- [x] Redesign the learner activity page around a stronger reading surface.
- [x] Reduce shell weight around the activity itself.
- [x] Improve instruction, example, and response spacing.
- [x] Keep back navigation available but visually quiet.
- [x] Improve the relationship between working state, submit state, and completion state.
- [x] Ensure the activity runtime does not feel like a generic form renderer.

## Slice 6: Shared Learner Interaction Patterns

- [x] Standardize learner loading states.
- [x] Standardize learner error and recovery states.
- [x] Standardize submit and completion patterns.
- [x] Standardize touch-friendly button sizing and action spacing.
- [x] Standardize any learner-facing callouts, hints, and secondary notes.

## Slice 7: Studio Boundary Review

- [x] Move any remaining learner runtime diagnostics fully behind studio mode.
- [x] Confirm no raw payloads or trace language remain in product mode.
- [x] Verify the runtime diagnostics drawer still gives enough operator visibility.
- [x] Confirm studio mode does not structurally distort learner layouts.

## Slice 8: Responsive QA

- [x] Verify `/learner` at common laptop widths.
- [x] Verify `/learner` at tablet widths.
- [x] Verify parent `Today` makes learner activity access obvious at common laptop widths.
- [x] Verify `/activity/[sessionId]` at common laptop widths.
- [x] Verify `/activity/[sessionId]` at tablet widths.
- [x] Verify the core learner flow at a narrow phone width.
- [x] Verify touch targets, sticky controls, and submit actions feel comfortable.

## Docs And Tracking

- [x] Update [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) as Phase 6 starts and finishes.
- [x] Keep [phase6_learner_flow_redesign.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_flow_redesign.md) current if implementation decisions change.
- [x] Keep [phase6_learner_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_surface_inventory.md) current if learner scope changes.
- [x] Record any deferrals before moving to the next phase.

## Exit Criteria

- [x] The learner shell feels quieter and lighter than the parent shell.
- [x] The learner home reads clearly as a daily queue.
- [x] Parent `Today` clearly hands off into learner activity work.
- [x] Activity runtime feels focused, readable, and touch-friendly.
- [x] Product mode is free of runtime diagnostics and debug clutter.
- [x] Studio diagnostics remain easy to reach.
- [x] Learner routes feel like the same product family as the Phase 5 parent redesign.

## Remaining Signoff Check

- [ ] Verify one live learner session through a fully completed end state.
- [ ] If available, live-verify empty, up-next, and completed queue groupings.
