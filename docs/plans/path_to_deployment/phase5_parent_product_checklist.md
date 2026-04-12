# Phase 5: Parent Product Redesign Checklist

Use this alongside [phase5_parent_product_redesign.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase5_parent_product_redesign.md) and [phase5_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase5_surface_inventory.md).

This is the execution tracker for the parent-facing redesign pass.

## Status

- [x] Phase 5 planning started
- [ ] Phase 5 implementation started
- [ ] Phase 5 reviewed on staging
- [ ] Phase 5 merged to `main`

## Slice 1: Design Direction Lock

- [ ] Reconfirm the Phase 5 visual goals before implementation starts.
- [ ] Lock the “calm premium learning studio” direction as the reference for the phase.
- [ ] Confirm that product mode stays quiet and studio mode stays additive.
- [ ] Confirm the redesign will preserve existing core logic and route behavior.
- [ ] Confirm `Today` remains the primary operational center.

## Slice 2: Shared Shell And Layout System

- [ ] Audit the current parent shell, workspace rail, top bar, and global tabs.
- [ ] Remove duplicated or competing navigation layers.
- [ ] Redesign the shell into a thinner, calmer frame.
- [ ] Define the final placement for learner switching.
- [ ] Define the final placement for studio access.
- [ ] Standardize page containers, max widths, and section spacing.
- [ ] Verify the shell feels consistent across `Today`, `Planning`, `Curriculum`, `Tracking`, and `Copilot`.

## Slice 3: Shared Design Language

- [ ] Lock typography for display, section headers, body text, and metadata.
- [ ] Define the reading-surface primitive for text-heavy content.
- [ ] Standardize quiet panel styling for reusable surfaces.
- [ ] Standardize callouts, examples, and inline secondary notes.
- [ ] Standardize disclosure components for secondary detail.
- [ ] Standardize empty, loading, and error state patterns.
- [ ] Audit shared primitives for any styles that fight the new direction.

## Slice 4: Today Redesign

- [ ] Rework `Today` as the primary operational surface.
- [ ] Make the first screen read clearly without dashboard clutter.
- [ ] Improve the daily reading surface for lesson content.
- [ ] Keep the next relevant actions local to the content they affect.
- [ ] Move secondary context out of the primary flow unless needed.
- [ ] Keep studio/debug access available without default visual noise.
- [ ] Verify `Today` works cleanly at laptop and tablet widths.

## Slice 5: Planning Redesign

- [ ] Reduce control overload in planning surfaces.
- [ ] Improve readability of route, day, and schedule content.
- [ ] Convert long planning details into reading-friendly surfaces.
- [ ] Collapse repair/setup/debug detail by default.
- [ ] Make the path from weekly planning to daily execution feel coherent.

## Slice 6: Curriculum Redesign

- [ ] Clarify hierarchy from curriculum source to details.
- [ ] Improve the source-detail reading experience.
- [ ] Reduce AI tooling clutter in product mode.
- [ ] Keep revise/customize flows accessible but visually secondary.
- [ ] Verify the curriculum area feels consistent with `Today` and `Planning`.

## Slice 7: Tracking Redesign

- [ ] Remove dashboard-like filler from tracking.
- [ ] Improve list, filter, and summary clarity.
- [ ] Simplify metadata and badge noise.
- [ ] Make reports feel useful and readable rather than analytical for its own sake.

## Slice 8: Copilot Redesign

- [ ] Keep Copilot chat-first.
- [ ] Improve message readability and spacing.
- [ ] Reduce any “separate AI product” feeling.
- [ ] Keep studio trace and prompt data available behind the product flow.
- [ ] Verify Copilot feels embedded in the app’s overall design language.

## Slice 9: Onboarding And Auth Cleanup

- [ ] Bring auth pages into the same product tone.
- [ ] Bring onboarding into the same product tone.
- [ ] Remove unnecessary instructional copy.
- [ ] Ensure auth and onboarding do not feel visually disconnected from the app.

## Slice 10: Product/Studio Boundary Review

- [ ] Review every redesigned parent surface in product mode.
- [ ] Review every redesigned parent surface in studio mode.
- [ ] Confirm debug information is still easy to reach.
- [ ] Confirm studio mode does not structurally distort product layouts.

## Slice 11: Responsive And Cross-Surface QA

- [ ] Verify the shell and key parent routes at common laptop widths.
- [ ] Verify the shell and key parent routes at tablet widths.
- [ ] Verify text-heavy surfaces maintain readable measure and spacing.
- [ ] Verify disclosures, sheets, and drawers behave predictably.
- [ ] Verify the app still feels coherent after moving between all major parent routes.

## Docs And Tracking

- [ ] Update [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) as Phase 5 starts and finishes.
- [ ] Keep [phase5_parent_product_redesign.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase5_parent_product_redesign.md) current if implementation decisions change.
- [ ] Keep [phase5_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase5_surface_inventory.md) current if scope changes.
- [ ] Record any deferrals before moving to Phase 6.

## Exit Criteria

- [ ] The parent shell feels calm, premium, and lighter than the current app.
- [ ] `Today` clearly reads as the primary operational center.
- [ ] Long-form educational content uses reading surfaces instead of cramped card stacks.
- [ ] Secondary detail is collapsed by default on major parent surfaces.
- [ ] Studio mode remains easy to access and visually secondary.
- [ ] `Planning`, `Curriculum`, `Tracking`, and `Copilot` feel like one coherent product.
