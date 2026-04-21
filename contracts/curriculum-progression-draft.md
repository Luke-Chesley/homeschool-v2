# Contract: Curriculum Progression Draft

- **Status:** Active
- **Canonical Artifact Name:** ProgressionArtifact
- **Current Version:** learning-core skill version

## Purpose
The Curriculum Progression Draft is the structured output returned by `learning-core` when the app executes `progression_generate`. It defines learning phases and dependency edges using stable `skillRef` identifiers.

## Producers
- **Entrypoints:** `learning-core: POST /v1/operations/progression_generate/execute`
- **Canonical Source Files:**
  - `learning-core/learning_core/skills/progression_generate/SKILL.md`
  - `learning-core/learning_core/contracts/progression.py`

## Consumers
- **Entrypoints:**
  - `lib/learning-core/curriculum.ts`
  - `lib/curriculum/progression-regeneration.ts`
- **Processing Logic:**
  - The app resolves `skillRef` values back to persisted curriculum nodes before storing progression data.

## Persistence
- **Storage Location:** Stored only after app-side resolution/normalization. Raw draft output may be kept in debug metadata.
- **Storage Shape:** Direct JSON object with `phases` and `edges`.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| phases | array | Ordered learning phases. |
| edges | array | Explicit dependency edges between skills. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| phases[].description | string | Optional description for a phase. |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| lineage.skill_version | learning-core response | Captured by the app for audit/debug. |

## Defaults & Fallbacks
- The app does not infer missing phases or edges at generation time. It consumes the returned artifact or treats the call as failed.

## Validation & Invariants
- Every `skillRef` must come from the input skill catalog.
- Every `skillRef` must appear in exactly one phase.
- `hardPrerequisite` edges must be acyclic.
- No self-loops.

## Ownership & Hierarchy
- **Parent:** Curriculum source
- **Children:** Resolved progression phases and edges

## Change Impact
- **Downstream Effects:** Changes affect progression normalization, curriculum graph display, and planning order.
- **Related Contracts:** `curriculum-progression-resolved.md`

## Known Gaps / TODOs
- The app still resolves `skillRef` values locally because persisted curriculum nodes remain product-owned records.
