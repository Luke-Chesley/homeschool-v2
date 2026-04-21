# Contract: Curriculum Artifact

- **Status:** Active
- **Canonical Artifact Name:** CurriculumArtifact
- **Current Version:** learning-core skill version

## Purpose
The Curriculum Artifact is the durable structured output returned by `learning-core` when the app executes `curriculum_generate`. It is the source material that `homeschool-v2` normalizes and persists as curriculum records.

## Producers
- **Entrypoints:** `learning-core: POST /v1/operations/curriculum_generate/execute`
- **Canonical Source Files:**
  - `learning-core/learning_core/skills/curriculum_generate/SKILL.md`
  - `learning-core/learning_core/contracts/curriculum.py`
  - `lib/learning-core/curriculum.ts`
  - `lib/homeschool/onboarding/curriculum.ts`

## Consumers
- **Entrypoints:**
  - `lib/curriculum/normalization.ts`
  - `lib/curriculum/service.ts`
- **Processing Logic:**
  - `homeschool-v2` persists the raw artifact in source metadata and normalizes units, lessons, and tree nodes into product tables.

## Persistence
- **Storage Location:**
  - Raw artifact in `curriculum_sources.metadata`
  - Normalized nodes in `curriculum_items`
- **Storage Shape:**
  - Raw shape follows the `CurriculumArtifact` schema from `learning-core`.
  - Normalized rows follow the local curriculum DB schema.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| source | object | Curriculum metadata such as title, summary, subjects, and framing notes. |
| intakeSummary | string | Summary of the intake conversation that grounded generation. |
| pacing | object | Declared pacing expectations for the curriculum. |
| document | object | Canonical domain -> strand -> goal group -> skill hierarchy. |
| units | array | Ordered teachable sequence built from the hierarchy. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| source.academicYear | string | Intended academic year when supplied. |
| source.parentNotes | string[] | Parent-facing notes or constraints. |
| source.rationale | string[] | Design rationale returned by the skill. |
| pacing.coverageNotes | string[] | Notes about scope and sequencing. |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| normalizedPath | document | Generated during normalization for stable node identity and graph linking. |
| sequenceIndex | units/document | Generated during normalization for ordering. |

## Defaults & Fallbacks
- **None in app code:** `homeschool-v2` does not inject prompt-side defaults for this artifact. Missing required fields should fail at the boundary.

## Validation & Invariants
- Tree shape is always `domain -> strand -> goal group -> skill`.
- Lessons must remain teachable in the declared pacing.
- Skills referenced by units and lessons must exist in the tree.

## Ownership & Hierarchy
- **Parent:** Curriculum Source
- **Children:** Curriculum items, units, lessons, downstream progression records

## Change Impact
- **Downstream Effects:** Changes here affect normalization, planning, and progression generation.
- **Related Contracts:**
  - `curriculum-revision-artifact.md`
  - `curriculum-progression-generation-input.md`
  - `lesson-draft-artifact.md`

## Known Gaps / TODOs
- Cross-repo contract codegen does not exist yet, so the app still validates the boundary with local consumer code and docs.
