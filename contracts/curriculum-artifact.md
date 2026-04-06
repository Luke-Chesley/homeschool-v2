# Contract: Curriculum Artifact

- **Status:** Active
- **Canonical Artifact Name:** CurriculumDraft
- **Current Version:** 3.2.0 (Prompt Version)

## Purpose
The Curriculum Artifact represents the first-class output of the AI curriculum generation process. It provides the hierarchical structure of learning goals (the "document"), the chronological sequence of lessons (the "outline"), and an explicit progression model.

## Producers
- **Entrypoints:** `CurriculumAiDraftService.generateCurriculumArtifact()` (Two-pass internal orchestration)
- **Canonical Source Files:**
  - `lib/prompts/curriculum-draft.ts` (JSON shape in `CURRICULUM_GENERATION_SYSTEM_PROMPT` and `CURRICULUM_PROGRESSION_SYSTEM_PROMPT`)
  - `lib/curriculum/ai-draft-service.ts`

## Consumers
- **Entrypoints:**
  - `app/api/curriculum/draft/route.ts` (if applicable)
  - `lib/curriculum/normalization.ts`
- **Processing Logic:**
  - `lib/curriculum/normalization.ts`: Transforms the raw AI artifact into normalized `CurriculumNode`, `CurriculumUnit`, and `CurriculumLesson` entities for persistence in the database.

## Persistence
- **Storage Location:** 
  - Raw JSON is stored in `curriculum_sources.metadata`.
  - Normalized data is persisted in the `curriculum_items` table.
- **Storage Shape:** 
  - The raw JSON follows the generation prompt shape.
  - Normalized database rows follow the schema in `lib/db/schema/curriculum.ts` where `itemType` distinguishes units and lessons.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| source | object | Metadata about the curriculum (title, description, subjects, gradeLevels). |
| intakeSummary | string | Summary of the intake conversation. |
| pacing | object | Pacing expectations (totalWeeks, sessionsPerWeek, totalSessions). |
| document | object | The hierarchical curriculum tree (Domain -> Strand -> Goal group -> Skill[]). |
| units | array | Chronological units containing lesson sequences. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| progression | object | Explicit global progression graph (phases and dependency edges). |
| source.academicYear | string | The intended academic year. |
| source.parentNotes | string[] | Additional notes for the parent. |
| source.rationale | string[] | Rationale for the curriculum design. |
| pacing.coverageNotes | string[] | Notes on how the scope is covered. |
| units[].lessons[].subject | string | Subject for a specific lesson. |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| normalizedPath | document | Path string like `domain/strand/goal_group/skill` used for node matching. |
| sequenceIndex | document/units | Order of appearance in the nested document or lesson list. |

## Defaults & Fallbacks
- **Estimated Minutes:** Defaults to `pacing.sessionMinutes` or 30 if not specified in individual lessons.
- **Progression:** If the `progression` section is missing, the system may fall back to inferred linear order from the document tree, but this is deprecated.
- **Title:** The generation prompt is instructed to produce a concise, parent-facing title.

## Validation & Invariants
- **Tree Depth:** Always `Domain` -> `Strand` -> `Goal Group` -> `Skill`.
- **Progression Skills:** All `skillTitles` in phases and edges MUST exist as leaf nodes in the `document` tree.
- **Cycle Detection:** `hardPrerequisite` edges must form an acyclic graph.
- **Relationship:** Every skill must belong to a goal group, every goal group to a strand, etc.
- **Units/Lessons:** Must cover the curriculum in a teachable order.
- **Pacing:** Total sessions must align with the requested scope and weekly cadence.

## Ownership & Hierarchy
- **Parent:** Household + Learner
- **Children:** Units (Sequence), Nodes (Hierarchy)

## Change Impact
- **Downstream Effects:** 
  - Changes to `progression` affect weekly route generation and the global planner's sequencing.
  - Changes to pacing fields impact planning logic and lesson draft timing.
- **Related Contracts:**
  - `curriculum-revision-artifact.md`: Inherits and modifies this shape.
  - `lesson-draft-artifact.md`: Consumes lessons and objectives from this artifact.

## Known Gaps / TODOs
- **Skill IDs:** The raw artifact uses titles as keys; IDs are generated during normalization.
- **Timing:** Pacing is currently descriptive; stronger validation between unit sessions and lesson counts is needed.
