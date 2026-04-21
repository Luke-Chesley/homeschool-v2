# Contract: Curriculum Revision Artifact

- **Status:** Active
- **Canonical Artifact Name:** CurriculumRevisionTurn
- **Current Version:** learning-core skill version

## Purpose
The Curriculum Revision Artifact is the structured response returned by `learning-core` for `curriculum_revise`. It either asks for clarification or returns a full revised curriculum artifact ready for persistence.

## Producers
- **Entrypoints:** `learning-core: POST /v1/operations/curriculum_revise/execute`
- **Canonical Source Files:**
  - `learning-core/learning_core/skills/curriculum_revise/SKILL.md`
  - `learning-core/learning_core/contracts/curriculum.py`
  - `lib/learning-core/curriculum.ts`

## Consumers
- **Entrypoints:**
  - `app/api/curriculum/sources/[sourceId]/ai-revise/route.ts`
  - `lib/curriculum/service.ts`
- **Processing Logic:**
  - If `action = "apply"`, the returned `artifact` replaces the prior draft/source state and is re-normalized.
  - If `action = "clarify"`, the app surfaces `assistantMessage` and does not mutate curriculum state.

## Persistence
- **Storage Location:** Applied revisions update the curriculum source metadata and downstream normalized curriculum tables.
- **Storage Shape:** The nested `artifact` field follows the same shape documented in `curriculum-artifact.md`.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| assistantMessage | string | Parent-facing response for the revision turn. |
| action | enum | `clarify` or `apply`. |
| changeSummary | string[] | Concise summary of what changed or what will change. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| artifact | object | Full revised curriculum artifact when `action = "apply"`. |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| lineage.skill_version | learning-core response | Stored by the app for auditing which revision skill version produced the turn. |

## Defaults & Fallbacks
- `homeschool-v2` does not synthesize partial diffs or fallback revisions. `learning-core` must return a valid turn or fail.

## Validation & Invariants
- `artifact` must be present when `action = "apply"`.
- The revised artifact must preserve the canonical curriculum hierarchy.
- Clarification turns must not mutate persisted curriculum state.

## Ownership & Hierarchy
- **Parent:** Curriculum Source
- **Children:** Revised curriculum artifact plus normalized curriculum items if applied

## Change Impact
- **Downstream Effects:** Applied revisions can invalidate prior plans, session drafts, and progression outputs.
- **Related Contracts:** `curriculum-artifact.md`

## Known Gaps / TODOs
- Revision history is still coarse because the app stores whole-artifact revisions rather than structural diffs.
