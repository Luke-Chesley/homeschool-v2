# Contract: Lesson Draft Artifact

- **Status:** Active
- **Canonical Artifact Name:** StructuredLessonDraft
- **Current Version:** 1.0 (Schema Version)

## Purpose
The Lesson Draft Artifact represents a detailed plan for a single teaching session. It is generated from curriculum lessons and objectives, and it provides the structured data needed for the parent-facing teaching interface.

## Producers
- **Entrypoints:** `app/api/ai/lesson-plan/route.ts` (if applicable) or `TaskService.generateLessonDraft()`
- **Canonical Source Files:**
  - `lib/prompts/lesson-draft.ts` (JSON shape in `LESSON_DRAFT_SYSTEM_PROMPT`)
  - `lib/lesson-draft/types.ts` (Schema definition)

## Consumers
- **Entrypoints:**
  - `app/(parent)/today/page.tsx`
  - `components/activities/ActivityShell.tsx` (when creating activities)
- **Processing Logic:**
  - UI components render lesson blocks, success criteria, and teacher notes for the parent.
  - Activity generation service uses the draft as the primary input.

## Persistence
- **Storage Location:** 
  - Stored in the `generated_artifacts` table with `artifactType = 'lesson_plan'`.
  - Linked to `plan_items` via `plan_item_id`.
- **Storage Shape:** 
  - Follows the `StructuredLessonDraft` interface in `lib/lesson-draft/types.ts` stored in the `body` column (as JSON string).

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| schema_version | string | Always "1.0". |
| title | string | Title of the lesson. |
| lesson_focus | string | One-sentence summary. |
| primary_objectives | string[] | 1-3 learning objectives (<= 20 words each). |
| success_criteria | string[] | Observable indicators of success. |
| total_minutes | number | Total planned time. |
| blocks | array | Ordered sequence of `LessonBlock` objects. |
| materials | string[] | Materials needed. |
| teacher_notes | string[] | Short bullet notes for live instruction. |
| adaptations | array | `LessonAdaptation` objects for different scenarios. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| prep | string[] | Pre-lesson preparation steps. |
| assessment_artifact | string | Artifact/evidence to collect. |
| extension | string | For learners ready for more. |
| follow_through | string | Carry forward to next session. |
| co_teacher_notes | string[] | Notes for a second adult. |
| accommodations | string[] | Specific learner accommodations. |
| lesson_shape | string | Meta-template used for block selection. |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| block minutes | blocks | Must sum to `total_minutes` +/- 15%. |

## Defaults & Fallbacks
- **Total Minutes:** Defaults to the estimated minutes from the curriculum lesson or 30 minutes.
- **Legacy Mode:** If `schema_version` is "legacy", the UI expects a `markdown` field.

## Validation & Invariants
- **Instructional Block:** Must include at least one instructional block (e.g., `model`, `guided_practice`).
- **Visible Check:** Must include at least one check (e.g., `check_for_understanding`, `reflection`).
- **Short & Operational:** Text should be concise; no narrative paragraphs.

## Ownership & Hierarchy
- **Parent:** Plan Item (Daily Plan)
- **Children:** Activities (Generated from the draft)

## Change Impact
- **Downstream Effects:** Changing the draft shape breaks the teaching UI and activity generation.
- **Related Contracts:**
  - `activity-artifact.md`: Consumes this draft to generate activities.

## Known Gaps / TODOs
- **Timing:** Total minutes validation between blocks and the header is loosely enforced.
- **Materials:** De-duplication between curriculum materials and generated materials is needed.
