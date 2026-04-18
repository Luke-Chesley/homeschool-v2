# Contract: Source Interpretation Artifact

- **Status:** Active
- **Canonical Artifact Name:** SourceInterpretationArtifact
- **Current Version:** 1.0.0

## Purpose
The Source Interpretation Artifact is the bounded classification result returned before onboarding creates a durable curriculum. It identifies what kind of source the family supplied, how onboarding should enter that source safely, and how later continuation could resume without treating the whole source as immediate launch scope.

## Producers
- **Entrypoints:**
  - `learning-core: POST /v1/operations/source_interpret/execute`
  - `lib/learning-core/source-interpret.ts`
- **Canonical Source Files:**
  - `learning-core/learning_core/contracts/source_interpret.py`
  - `learning-core/learning_core/skills/source_interpret/SKILL.md`
  - `learning-core/learning_core/skills/source_interpret/scripts/main.py`

## Consumers
- **Entrypoints:**
  - `app/api/homeschool/onboarding/route.ts`
  - `lib/homeschool/onboarding/service.ts`
  - `lib/homeschool/onboarding/fast-path.ts`
  - `lib/homeschool/onboarding/curriculum.ts`
- **Processing Logic:**
  - `buildFastPathPreview(...)` maps the interpretation into the bounded launch route, chosen horizon, and user-facing scope summary.
  - `createFastPathCurriculumFromSource(...)` forwards the entry metadata into `curriculum_generate` with `requestMode: "source_entry"`.
  - Selected fields are persisted into `sourceModel`, `launchPlan`, and `curriculumLineage` metadata so later continuation can resume from the same source entry point.

## Persistence
- **Storage Location:**
  - Organization onboarding metadata
  - `curriculum_sources.intake`
- **Storage Shape:**
  - The raw artifact is not stored verbatim as one JSON blob.
  - Durable source metadata stores the canonical interpretation fields in `sourceModel` and the bounded opening window in `launchPlan`.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| sourceKind | enum | Canonical source classification: `bounded_material`, `timeboxed_plan`, `structured_sequence`, `comprehensive_source`, `topic_seed`, `shell_request`, or `ambiguous`. |
| entryStrategy | enum | Launch entry rule: `use_as_is`, `explicit_range`, `sequential_start`, `section_start`, `timebox_start`, or `scaffold_only`. |
| continuationMode | enum | Future continuation hint: `none`, `sequential`, `timebox`, or `manual_review`. |
| suggestedTitle | string | Bounded title candidate grounded in the interpreted source. |
| confidence | enum | Interpretation confidence: `low`, `medium`, or `high`. |
| recommendedHorizon | enum | Model-recommended initial planning window: `single_day`, `few_days`, `one_week`, `two_weeks`, or `starter_module`. |
| assumptions | string[] | Short operational assumptions the model relied on. |
| detectedChunks | string[] | One to six chunk labels or excerpts grounded in the supplied source. |
| needsConfirmation | boolean | Signals whether onboarding should stop for preview before saving. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| entryLabel | string or null | Human-readable starting anchor such as `chapter 1` or `pages 1–12`. |
| followUpQuestion | string or null | Single clarifying question when one answer would materially change routing or scope. |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| intakeRoute | `sourceKind` | Derived in `sourceKindToRoute(...)` for onboarding routing. |
| chosenHorizon | `recommendedHorizon` + route/source caps | Derived by `resolveFastPathChosenHorizon(...)` after internal clamping and low-confidence safety limits. |
| scopeSummary | `sourceKind`, `entryStrategy`, `entryLabel`, `chosenHorizon` | User-facing summary of the bounded opening. |

## Defaults & Fallbacks
- **entryLabel:** `null` when no grounded starting anchor is available.
- **detectedChunks:** Falls back to short normalized source lines when the model does not supply better chunk labels.
- **needsConfirmation:** Must be `true` when confidence is low, the source is ambiguous, or a follow-up question is required.

## Validation & Invariants
- `recommendedHorizon` is the initial planning window, not total curriculum scope.
- `comprehensive_source` is valid and must still stay bounded at launch.
- `entryStrategy`, `recommendedHorizon`, and `continuationMode` are always required.
- The artifact must not contain lesson content, curriculum structure, or continuation implementation details.

## Ownership & Hierarchy
- **Parent:** Organization / learner onboarding request
- **Children:** `curriculum_generate` source-entry request, persisted curriculum metadata

## Change Impact
- **Downstream Effects:** Changes affect onboarding preview gating, `curriculum_generate` source-entry inputs, persisted source metadata, and Today lesson-generation context.
- **Related Contracts:** `normalized-intake-source-package.md`, `curriculum-artifact.md`, `lesson-draft-artifact.md`

## Known Gaps / TODOs
- Future continuation will reuse this metadata but is not implemented in this contract.
- `homeschool-v2` persists a projection of the artifact rather than the raw response, so future fields must be added deliberately on both sides.
