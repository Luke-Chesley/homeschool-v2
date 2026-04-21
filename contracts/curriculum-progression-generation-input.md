# Contract: Curriculum Progression Generation Input

- **Status:** Active
- **Canonical Artifact Name:** ProgressionGenerationOperationEnvelope
- **Current Version:** request-envelope v1

## Purpose
This contract describes the structured request envelope `homeschool-v2` sends to `learning-core` when previewing or executing `progression_generate`. The app sends data only. `learning-core` owns prompt assembly.

## Producers
- **Entrypoints:**
  - `lib/learning-core/curriculum.ts`
  - `lib/curriculum/progression-regeneration.ts`
- **Canonical Source Files:**
  - `learning-core/learning_core/contracts/operation.py`
  - `learning-core/learning_core/contracts/progression.py`
  - `lib/learning-core/curriculum.ts`

## Consumers
- **Entrypoints:**
  - `learning-core: POST /v1/operations/progression_generate/prompt-preview`
  - `learning-core: POST /v1/operations/progression_generate/execute`
- **Processing Logic:**
  - `learning-core` validates the envelope, builds the effective prompts, and returns either a preview or a progression artifact.

## Persistence
- **Storage Location:** Transient request payload only. The app may display it in debug UI via `prompt_preview.request_envelope`.
- **Storage Shape:** Matches the generalized `OperationEnvelope` plus `ProgressionGenerationRequest`.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| input.learnerName | string | Active learner display name. |
| input.sourceTitle | string | Curriculum source title. |
| input.skillCatalog | array | Authoritative skill list for progression sequencing. |
| app_context | object | Product/runtime metadata such as learner, surface, and request origin. |
| presentation_context | object | Output framing and preview flags. |
| user_authored_context | object | Optional freeform notes and constraints. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| input.sourceSummary | string | Curriculum summary for sequencing context. |
| request_id | string | Caller-supplied request identifier. |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| prompt_preview.request_envelope | learning-core response | Echoed sanitized envelope for debug tooling. |

## Defaults & Fallbacks
- No raw prompt fragments are built in the app.
- Unsupported fields should fail validation instead of being silently ignored.

## Validation & Invariants
- `skillCatalog` is authoritative.
- Each `skillRef` must be stable and unique within the request.
- The app may not send raw system prompts or message arrays for this operation.

## Ownership & Hierarchy
- **Parent:** Curriculum source + active learner context
- **Children:** Prompt preview output or progression artifact

## Change Impact
- **Downstream Effects:** Shape changes affect prompt preview routes, progression generation, and debug UI.
- **Related Contracts:** `curriculum-progression-draft.md`

## Known Gaps / TODOs
- Shared codegen for envelope schemas across repos is still pending.
