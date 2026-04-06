# Contract: Activity Artifact

- **Status:** Active
- **Canonical Artifact Name:** ActivitySpec
- **Current Version:** 2 (Schema Version)

## Purpose
The Activity Artifact represents a structured, AI-generated specification for an interactive learner experience. It is designed to be rendered deterministically by a bounded component library, avoiding arbitrary UI code.

## Producers
- **Entrypoints:** `ActivityGenerationService.generateActivity()`
- **Canonical Source Files:**
  - `lib/prompts/activity-spec.ts` (JSON shape in `ACTIVITY_SPEC_SYSTEM_PROMPT`)
  - `lib/activities/spec.ts` (Zod schema for v2 specs)

## Consumers
- **Entrypoints:**
  - `app/(learner)/activity/[id]/page.tsx`
  - `components/activities/ActivityRenderer.tsx`
- **Processing Logic:**
  - Renderers in `components/activities/` interpret the `components` list to display the UI.
  - The `scoringModel` and `evidenceSchema` define how the runtime captures and scores learner input.

## Persistence
- **Storage Location:** 
  - Durable specifications are stored in the `interactive_activities` table (when published) or `generated_artifacts` table (as `interactive_blueprint`).
  - Runtime state (attempts) is stored in the `activity_attempts` table.
  - Granular interaction data is stored in the `activity_evidence` table.
- **Storage Shape:** 
  - Durable definition follows `ActivitySpec` (v2) stored in `interactive_activities.definition`.
  - Attempts follow `ActivityAttempt` in `lib/activities/types.ts`.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| schemaVersion | string | Always "2" for new specs. |
| title | string | Title of the activity. |
| purpose | string | Plain-language statement of learning intent. |
| activityKind | enum | Type of activity (e.g., quiz, matching, guided_practice). |
| estimatedMinutes | number | Expected duration. |
| interactionMode | enum | `digital`, `offline`, or `hybrid`. |
| components | array | Ordered list of `ComponentSpec` objects from the supported library. |
| evidenceSchema | object | Configuration for capturing learner evidence. |
| scoringModel | object | Strategy for scoring the activity. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| linkedObjectiveIds | string[] | IDs of curriculum objectives addressed. |
| linkedSkillTitles | string[] | Skill names for context. |
| completionRules | object | Rules for when the activity is considered complete. |
| adaptationRules | object | Hint strategy and retry rules. |
| teacherSupport | object | Setup notes, discussion questions, etc. |
| offlineMode | object | Task description for non-digital activities. |
| templateHint | enum | Hint for overall activity shape (e.g., practice_heavy). |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| score | attempt | Calculated based on the `scoringModel` during or after the session. |

## Defaults & Fallbacks
- **Completion Rules:** Defaults to `all_interactive_components`.
- **Hint Strategy:** Defaults to `on_request`.

## Validation & Invariants
- **Interactive Component:** At least one interactive component (e.g., `short_answer`, `single_select`) must be present.
- **Component IDs:** Must be unique within the activity.
- **Auto-scorable:** `autoScorable` evidence only works with `correctness_based` scoring.

## Ownership & Hierarchy
- **Parent:** Lesson Draft / Plan Item
- **Children:** Activity Sessions, Attempts, Outcomes

## Change Impact
- **Downstream Effects:** Changes to component schemas break rendering. Changes to evidence/scoring impact tracking and learner progress.
- **Related Contracts:**
  - `lesson-draft-artifact.md`: Provides the context for activity generation.

## Known Gaps / TODOs
- **Legacy Compatibility:** Transitioning from v1 (blueprint) to v2 (spec) is ongoing.
- **Renderer Parity:** Not all components in the spec have equivalent renderers in all platforms.
