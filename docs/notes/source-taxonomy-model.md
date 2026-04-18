# Source Taxonomy Model

This note records the taxonomy refactor boundary for `homeschool-v2`.

Fast onboarding now follows one source-first chain:

- `source_interpret`
- `curriculum_generate` with `requestMode: "source_entry"`
- planning / progression / day 1 from `launchPlan`

Regular curriculum creation uses the same `curriculum_generate` skill in `conversation_intake` mode.

## Canonical interpretation fields

Durable curriculum metadata now centers on three canonical blocks:

- `sourceModel`
- `launchPlan`
- `curriculumLineage`

`sourceModel` stores the interpretation fields:

- `sourceKind`
- `entryStrategy`
- `entryLabel`
- `continuationMode`
- `recommendedHorizon`
- `deliveryPattern`

The canonical `sourceKind` values are:

- `bounded_material`
- `timeboxed_plan`
- `structured_sequence`
- `comprehensive_source`
- `topic_seed`
- `shell_request`
- `ambiguous`

`comprehensive_source` is the important new bucket for a whole book, workbook, long PDF, teacher guide, or other source that is clearly larger than the initial launch window. It means “start from a bounded opening slice and keep the rest available,” not “generate the whole curriculum now.”

That durable curriculum should preserve later units for continuation while `launchPlan` bounds the opening route and day-1 handoff.

## Horizon semantics

`recommendedHorizon` is the model-recommended initial planning window, not the total curriculum length and not a user-selected preference.

The canonical values are:

- `single_day`
- `few_days`
- `one_week`
- `two_weeks`
- `starter_module`

`chosenHorizon` now lives on `launchPlan` because it is the explicit bounded launch decision after internal clamping. It is not a legacy alias. New code should treat `sourceModel.recommendedHorizon` as the model recommendation and `launchPlan.chosenHorizon` as the final bounded launch window.

## No User Horizon Choice

The launch model no longer treats horizon as a parent-controlled chooser. The parent can confirm or correct source interpretation, but the system owns the initial bounded horizon recommendation.

That means new docs, tests, and metadata should not reintroduce:

- the removed day/week horizon aliases from the pre-refactor onboarding model
- the removed parent horizon-intent field
- explicit parent horizon-picking language

## Future Continuation Metadata

Large sources need a continuation breadcrumb even when the first launch stays small. The durable metadata is:

- `sourceModel.sourcePackageId`
- `sourceModel.sourceModality`
- `sourceModel.entryStrategy`
- `sourceModel.entryLabel`
- `sourceModel.continuationMode`
- `sourceModel.recommendedHorizon`
- `sourceModel.deliveryPattern`
- `sourceModel.detectedChunks`
- `launchPlan.chosenHorizon`
- launch-slice fields such as `launchPlan.initialSliceUsed`, `launchPlan.initialSliceLabel`, `launchPlan.openingLessonRefs`, and `launchPlan.openingSkillRefs`
- `curriculumLineage`

This metadata is intentionally lightweight. It exists so later “continue from source” work can resume from the next bounded slice without re-deriving the source interpretation from scratch.
