# Contract: Lesson Draft Artifact

- **Status:** Active
- **Canonical Artifact Name:** StructuredLessonDraft
- **Current Version:** schema `1.0`

## Purpose
The Lesson Draft Artifact is the structured session plan returned by `learning-core` for `session_generate`. It powers the parent-facing lesson view and acts as the upstream input for activity generation.

## Producers
- **Entrypoints:**
  - `learning-core: POST /v1/operations/session_generate/execute`
  - `app/api/ai/lesson-plan/route.ts`
- **Canonical Source Files:**
  - `learning-core/learning_core/skills/session_generate/SKILL.md`
  - `learning-core/learning_core/contracts/session_plan.py`
  - `lib/learning-core/session.ts`

## Consumers
- **Entrypoints:**
  - `app/(parent)/today/page.tsx`
  - `components/activities/ActivityShell.tsx`
- **Processing Logic:**
  - The app stores the returned draft as a generated artifact and as the current lesson draft for the day.
  - Activity generation uses the structured draft as its canonical upstream context.

## Persistence
- **Storage Location:**
  - `generated_artifacts` with `artifactType = 'lesson_plan'`
  - today-workspace lesson draft persistence in planning state
- **Storage Shape:** JSON body matches `StructuredLessonDraft`.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| schema_version | string | Schema version for the structured lesson draft. |
| title | string | Parent-facing lesson title. |
| lesson_focus | string | One-sentence summary of the lesson. |
| primary_objectives | string[] | Main objectives for the session. |
| success_criteria | string[] | Observable indicators of success. |
| total_minutes | number | Total planned time. |
| blocks | array | Ordered instructional blocks. |
| materials | string[] | Materials needed for the session. |
| teacher_notes | string[] | Operational notes for instruction. |
| adaptations | array | Trigger/action adaptations for live teaching. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| prep | string[] | Setup steps before the session. |
| assessment_artifact | string | Evidence or artifact to collect. |
| extension | string | Next step for learners who are ready for more. |
| follow_through | string | Carry-forward note for the next session. |
| co_teacher_notes | string[] | Notes for another adult. |
| accommodations | string[] | Learner accommodations. |
| lesson_shape | string | High-level planning pattern used by the skill. |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| promptVersion | lineage.skill_version | Stored by the app alongside the draft for traceability. |

## Defaults & Fallbacks
- The app no longer owns lesson-plan prompt defaults. Missing or invalid lesson-draft fields should fail at the `learning-core` boundary.

## Validation & Invariants
- Blocks should sum to approximately `total_minutes`.
- At least one instructional block must exist.
- At least one visible check for understanding must exist.
- Text remains short and operational.

## Ownership & Hierarchy
- **Parent:** Daily planning context / generated artifact record
- **Children:** Activity artifacts, attempts, evidence

## Change Impact
- **Downstream Effects:** Shape changes affect today workspace rendering and activity generation.
- **Related Contracts:** `activity-artifact.md`

## Known Gaps / TODOs
- The app still keeps a local consumer schema for fail-fast validation until cross-repo schema sharing is automated.
