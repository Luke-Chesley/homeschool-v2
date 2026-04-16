# Phase 5: Parent Product Redesign Checklist

Use this alongside [phase5_parent_product_redesign.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/phase5_parent_product_redesign.md) and [phase5_surface_inventory.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/phase5_surface_inventory.md).
Also use [phase5_checklist_design_review.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/phase5_checklist_design_review.md) as the completeness reference for flows and components.

This is the execution tracker for the parent-facing redesign pass.

## Status

- [x] Phase 5 planning started
- [x] Phase 5 implementation started
- [ ] Phase 5 reviewed on staging
- [ ] Phase 5 merged to `main`

## Slice 1: Design Direction Lock

- [ ] Reconfirm the Phase 5 visual goals before implementation starts.
- [ ] Lock the “calm premium learning studio” direction as the reference for the phase.
- [ ] Confirm that product mode stays quiet and studio mode stays additive.
- [ ] Confirm the redesign will preserve existing core logic and route behavior.
- [ ] Confirm `Today` remains the primary operational center.
- [ ] Review the applicable checklist.design references and carry their requirements into implementation.

## Slice 2: Shared Shell And Layout System

- [x] Audit the current parent shell, workspace rail, top bar, and global tabs.
- [x] Remove duplicated or competing navigation layers.
- [x] Redesign the shell into a thinner, calmer frame.
- [x] Define the final placement for learner switching.
- [x] Define the final placement for studio access.
- [x] Standardize page containers, max widths, and section spacing.
- [x] Verify the shell feels consistent across `Today`, `Planning`, `Curriculum`, `Tracking`, and `Copilot`.

## Slice 3: Shared Design Language

- [x] Lock typography for display, section headers, body text, and metadata.
- [x] Define the reading-surface primitive for text-heavy content.
- [x] Standardize quiet panel styling for reusable surfaces.
- [ ] Standardize callouts, examples, and inline secondary notes.
- [ ] Standardize disclosure components for secondary detail.
- [ ] Standardize empty, loading, and error state patterns.
- [ ] Standardize search, filter, toast, and save-state behavior across parent surfaces.
- [x] Audit shared primitives for any styles that fight the new direction.

## Slice 4: Today Redesign

- [x] Rework `Today` as the primary operational surface.
- [x] Make the first screen read clearly without dashboard clutter.
- [x] Improve the daily reading surface for lesson content.
- [x] Keep the next relevant actions local to the content they affect.
- [x] Move secondary context out of the primary flow unless needed.
- [x] Keep studio/debug access available without default visual noise.
- [ ] Verify `Today` works cleanly at laptop and tablet widths.

## Slice 5: Planning Redesign

- [x] Reduce control overload in planning surfaces.
- [x] Improve readability of route, day, and schedule content.
- [x] Convert long planning details into reading-friendly surfaces.
- [ ] Collapse repair/setup/debug detail by default.
- [x] Make the path from weekly planning to daily execution feel coherent.

## Slice 6: Curriculum Redesign

- [x] Clarify hierarchy from curriculum source to details.
- [x] Improve the source-detail reading experience.
- [x] Reduce AI tooling clutter in product mode.
- [x] Keep revise/customize flows accessible but visually secondary.
- [x] Verify the curriculum area feels consistent with `Today` and `Planning`.

## Slice 7: Tracking Redesign

- [x] Remove dashboard-like filler from tracking.
- [x] Improve list, filter, and summary clarity.
- [x] Simplify metadata and badge noise.
- [x] Make reports feel useful and readable rather than analytical for its own sake.

## Slice 8: Copilot Redesign

- [x] Keep Copilot chat-first.
- [x] Improve message readability and spacing.
- [x] Reduce any “separate AI product” feeling.
- [x] Keep studio trace and prompt data available behind the product flow.
- [x] Verify Copilot feels embedded in the app’s overall design language.

## Slice 9: Onboarding And Auth Cleanup

- [x] Bring auth pages into the same product tone.
- [x] Bring onboarding into the same product tone.
- [x] Remove unnecessary instructional copy.
- [x] Ensure auth and onboarding do not feel visually disconnected from the app.
- [ ] Apply login, sign-up, reset-password, and verification-flow standards from the checklist review.

## Slice 10: Product/Studio Boundary Review

- [x] Review every redesigned parent surface in product mode.
- [ ] Review every redesigned parent surface in studio mode.
- [x] Confirm debug information is still easy to reach.
- [x] Confirm studio mode does not structurally distort product layouts.

## Slice 11: Responsive And Cross-Surface QA

- [ ] Verify the shell and key parent routes at common laptop widths.
- [ ] Verify the shell and key parent routes at tablet widths.
- [ ] Verify text-heavy surfaces maintain readable measure and spacing.
- [ ] Verify disclosures, sheets, and drawers behave predictably.
- [ ] Verify the app still feels coherent after moving between all major parent routes.

## Docs And Tracking

- [x] Update [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/README.md) as Phase 5 starts and finishes.
- [ ] Keep [phase5_parent_product_redesign.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/phase5_parent_product_redesign.md) current if implementation decisions change.
- [ ] Keep [phase5_surface_inventory.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/phase5_surface_inventory.md) current if scope changes.
- [ ] Keep [phase5_checklist_design_review.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/phase5_checklist_design_review.md) current if scope or product surfaces change.
- [ ] Record any deferrals before moving to Phase 6.

## Exit Criteria

- [x] The parent shell feels calm, premium, and lighter than the current app.
- [x] `Today` clearly reads as the primary operational center.
- [x] Long-form educational content uses reading surfaces instead of cramped card stacks.
- [x] Secondary detail is collapsed by default on major parent surfaces.
- [x] Studio mode remains easy to access and visually secondary.
- [x] `Planning`, `Curriculum`, `Tracking`, and `Copilot` feel like one coherent product.
