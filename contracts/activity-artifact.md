# Contract: Activity Artifact

- **Status:** Active
- **Canonical Artifact Name:** ActivitySpec
- **Current Version:** 2 (Schema Version)

## Purpose
The Activity Artifact represents a structured, AI-generated specification for an interactive learner experience. It is designed to be rendered deterministically by a bounded component library, avoiding arbitrary UI code. Rich interactive tasks are represented through the bounded `interactive_widget` host rather than one-off top-level component types.

## Producers
- **Entrypoints:** `learning-core /v1/operations/activity_generate/execute`
- **Canonical Source Files:**
  - `lib/learning-core/activity.ts` (typed app adapter and boundary validation)
  - `lib/activities/spec.ts` (Zod schema for v2 specs)

## Consumers
- **Entrypoints:**
  - `app/(learner)/activity/[id]/page.tsx`
  - `components/activities/ActivityRenderer.tsx`
  - `app/api/activities/attempts/[attemptId]/feedback/route.ts`
- **Processing Logic:**
  - Renderers in `components/activities/` interpret the `components` list to display the UI.
  - The `scoringModel` and `evidenceSchema` define how the runtime captures and scores learner input.
  - Runtime feedback requests resolve the current component from the persisted ActivitySpec and send it to `learning-core` for bounded component-level evaluation.
  - `interactive_widget` delegates rendering to a generic host that chooses a bounded surface such as `board_surface`, `expression_surface`, or `graph_surface`.

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
- **Completion Rules:** Defaults are owned by `learning-core`; the app does not inject local fallbacks.
- **Hint Strategy:** Defaults are owned by `learning-core`; missing or invalid fields should fail at the service boundary.

## Validation & Invariants
- **Interactive Component:** At least one interactive component (e.g., `short_answer`, `single_select`) must be present.
- **Conditional Interactivity:** `interactive_widget` only counts as interactive when the nested widget mode accepts input.
- **Component IDs:** Must be unique within the activity.
- **Auto-scorable:** `autoScorable` evidence only works with `correctness_based` scoring.

## Notable Component Shapes

- `interactive_widget`
  - Bounded host for engine-backed tasks such as chess positions, symbolic math, and graphs
  - Contains nested `widget` data with `surfaceKind`, `engineKind`, `state`, `interaction`, `evaluation`, and `annotations`
  - Used for board-based tasks, structured expression input, and graph interactions without adding more top-level one-off components

## Ownership & Hierarchy
- **Parent:** Lesson Draft / Plan Item
- **Children:** Activity Sessions, Attempts, Outcomes

## Change Impact
- **Downstream Effects:** Changes to component schemas break rendering. Changes to evidence/scoring impact tracking and learner progress.
- **Related Contracts:**
  - `lesson-draft-artifact.md`: Provides the context for activity generation.

## Known Gaps / TODOs
- **Cross-Repo Contract Sharing:** `learning-core` is now the producer, but the app still keeps a local consumer schema for fail-fast boundary validation until shared contract codegen exists.
- **Renderer Parity:** Not all components in the spec have equivalent renderers in all platforms.
