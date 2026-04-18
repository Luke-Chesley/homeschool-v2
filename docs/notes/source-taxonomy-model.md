# Source Taxonomy Model

This note records the taxonomy refactor boundary for `homeschool-v2`.

## Canonical interpretation fields

Durable curriculum intake metadata now stores these canonical fields:

- `sourceKind`
- `entryStrategy`
- `entryLabel`
- `continuationMode`
- `recommendedHorizon`

The canonical `sourceKind` values are:

- `bounded_material`
- `timeboxed_plan`
- `structured_sequence`
- `comprehensive_source`
- `topic_seed`
- `shell_request`
- `ambiguous`

`comprehensive_source` is the important new bucket for a whole book, workbook, long PDF, teacher guide, or other source that is clearly larger than the initial launch window. It means “start from a bounded opening slice and keep the rest available,” not “generate the whole curriculum now.”

## Horizon semantics

`recommendedHorizon` is the model-recommended initial planning window, not the total curriculum length and not a user-selected preference.

The canonical values are:

- `single_day`
- `few_days`
- `one_week`
- `two_weeks`
- `starter_module`

`chosenHorizon` is still stored because it is the explicit bounded launch decision after internal clamping. It is not a legacy alias. New code should treat `recommendedHorizon` as the model recommendation and `chosenHorizon` as the final bounded launch window.

## No User Horizon Choice

The launch model no longer treats horizon as a parent-controlled chooser. The parent can confirm or correct source interpretation, but the system owns the initial bounded horizon recommendation.

That means new docs, tests, and metadata should not reintroduce:

- the removed day/week horizon aliases from the pre-refactor onboarding model
- the removed parent horizon-intent field
- explicit parent horizon-picking language

## Future Continuation Metadata

Large sources need a continuation breadcrumb even when the first launch stays small. The durable metadata is:

- `sourcePackageId`
- `sourceModality`
- `entryStrategy`
- `entryLabel`
- `continuationMode`
- `recommendedHorizon`
- `chosenHorizon`
- `detectedChunks`
- launch-slice summary fields such as `initialSliceUsed`, `initialSliceLabel`, and `initialLessonCount`

This metadata is intentionally lightweight. It exists so later “continue from source” work can resume from the next bounded slice without re-deriving the source interpretation from scratch.
