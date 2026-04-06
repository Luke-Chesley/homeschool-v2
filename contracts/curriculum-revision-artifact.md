# Contract: Curriculum Revision Artifact

- **Status:** Active
- **Canonical Artifact Name:** CurriculumRevisionTurn
- **Current Version:** 2.2.0 (Prompt Version)

## Purpose
The Curriculum Revision Artifact represents the outcome of a curriculum editing conversation. It can either ask for clarification or provide a fully revised curriculum artifact based on the parent's request (split, rename, adjust, or rewrite).

## Producers
- **Entrypoints:** `runCurriculumRevisionDecision()`
- **Canonical Source Files:**
  - `lib/prompts/curriculum-draft.ts` (JSON shape in `CURRICULUM_REVISION_SYSTEM_PROMPT`)
  - `lib/curriculum/revision-model.ts`

## Consumers
- **Entrypoints:**
  - `app/api/curriculum/revision/route.ts` (if applicable)
- **Processing Logic:**
  - The `apply` action triggers a full replacement or update of the current curriculum draft with the new `artifact`.

## Persistence
- **Storage Location:** 
  - If applied, the new `artifact` replaces the previous state in `curriculum_sources.metadata` and is then normalized into the `curriculum_items` table.
- **Storage Shape:** 
  - The revised `artifact` follows the same JSON shape as documented in `curriculum-artifact.md`.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| assistantMessage | string | AI's response to the parent. |
| action | enum | `clarify` (ask for info) or `apply` (update curriculum). |
| changeSummary | string[] | Bullet points explaining what was changed. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| artifact | object | The full revised curriculum artifact (required when `action` is `apply`). |

## Defaults & Fallbacks
- **Full Revised Artifact:** When action is `apply`, the model MUST return the entire revised artifact, not just the diff. Unchanged branches are inherited from the previous state.

## Validation & Invariants
- **Inheritance:** Unchanged branches must be preserved.
- **Tree Shape:** Must maintain the canonical `domain -> strand -> goal group -> skill` hierarchy.
- **Action Coherence:** If `action` is `apply`, the `artifact` field must be present and valid.

## Ownership & Hierarchy
- **Parent:** Curriculum Source
- **Children:** Same as `curriculum-artifact.md`.

## Change Impact
- **Downstream Effects:** Applying a revision impacts all existing planning and lesson drafts that were based on the previous version.
- **Related Contracts:**
  - `curriculum-artifact.md`: The shape of the `artifact` field.

## Known Gaps / TODOs
- **Diffing:** The system currently replaces the whole artifact rather than applying a targeted patch, making version history coarse.
- **Clarification:** Clarify how "clarify" mode handles partial information capture.
