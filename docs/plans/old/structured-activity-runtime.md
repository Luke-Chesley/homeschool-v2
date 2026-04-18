# Structured Activity Runtime

## What changed

The old activity layer was a fixed-blueprint system. `assignment-service.ts` generated hardcoded activity definitions keyed to `workflowMode` and `planItem.kind` — `guided_practice`, `reflection`, `checklist`, `rubric_response`, `file_submission`, or `supervisor_sign_off`. These were per-kind TypeScript unions with no AI involvement and no component-level flexibility.

The new system is a complete rewrite:

- **One canonical ActivitySpec** — replaces all per-kind blueprints.
- **Bounded component library** — 31 component types replace per-activity renderers.
- **AI generation** — activities are generated from lesson and curriculum context.
- **Structured evidence** — captures normalized evidence per component, separate from the activity definition.
- **Richer progress mapping** — 6 scoring modes beyond quiz percentage.
- **Offline/real-world activities** — first-class support.

The production path now: `PlanItem → generateActivitySpec() → ActivitySpec → persisted as activity_spec type → rendered by ActivitySpecRenderer`.

---

## The canonical ActivitySpec (schemaVersion "2")

```typescript
{
  schemaVersion: "2",
  title: string,
  purpose: string,
  activityKind: ActivityKind,
  linkedObjectiveIds: string[],
  linkedSkillLabels: string[],
  estimatedMinutes: number,
  interactionMode: "digital" | "offline" | "hybrid",
  components: ComponentSpec[],        // ordered, from bounded library
  completionRules: CompletionRules,
  evidenceSchema: EvidenceSpec,        // what evidence is captured
  scoringModel: ScoringModel,          // how progress is inferred
  adaptationRules?: AdaptationRules,
  teacherSupport?: TeacherSupport,
  offlineMode?: OfflineModeConfig,     // required for offline activities
  templateHint?: ActivityTemplateHint,
  metadata?: Record<string, unknown>,
}
```

Key design principle: **content, interaction, completion, evidence, and scoring are separate fields**, not collapsed into a single activity type. The same component types work across all activity kinds.

---

## Bounded component library (31 types)

Component types are fixed. The model cannot generate arbitrary UI code — it can only select from this list and fill in config.

### Content (no evidence)
`heading`, `paragraph`, `callout`, `image`, `divider`

### Simple input
`short_answer`, `text_response`, `rich_text_response`, `single_select`, `multi_select`, `rating`, `confidence_check`

### Structured interaction
`checklist`, `ordered_sequence`, `matching_pairs`, `categorization`, `sort_into_groups`, `label_map`, `hotspot_select`, `build_steps`, `drag_arrange`

### Reflection / self-assessment
`reflection_prompt`, `rubric_self_check`

### Evidence capture (offline + real-world)
`file_upload`, `image_capture`, `audio_capture`, `observation_record`, `teacher_checkoff`

### Complex / scaffolded
`compare_and_explain`, `choose_next_step`, `construction_space`

Each component type has a strict Zod config schema and produces typed evidence output.

---

## Activity kind taxonomy (separate from components)

`activityKind` captures **learning intent**, not UI shape:

`guided_practice`, `retrieval`, `demonstration`, `simulation`, `discussion_capture`, `reflection`, `performance_task`, `project_step`, `observation`, `assessment_check`, `collaborative`, `offline_real_world`

Any component type can appear in any activity kind. A `guided_practice` and an `assessment_check` can both use `single_select` — the kind tells the teacher why the activity exists; the components tell the learner how to interact with it.

---

## How generation works

1. `assignmentService.ensurePublishedActivitiesForLearner` calls `generateActivitySpecForPlanItem`.
2. `generateActivitySpecForPlanItem` builds an `ActivityGenerationContext` from the `PlanItem` and learner name.
3. `generateActivitySpec` sends the context to `getAdapterForTask("interactive.generate")` with the structured system prompt from `lib/prompts/activity-spec.ts`.
4. The model returns a JSON object. It is validated against `ActivitySpecSchema`.
5. If validation fails, one retry with correction notes is attempted.
6. If AI generation fails entirely (model unavailable, persistent validation failure), a deterministic fallback spec is built using `buildFallbackSpec`.
7. The result is persisted in `interactive_activities` with `activityType = "activity_spec"` and `schemaVersion = "2"`.

The generation prompt constrains the model to:
- Choose from the bounded component type list only
- Set completion rules, evidence schema, and scoring model
- Include `teacherSupport` with setup notes and mastery indicators
- Avoid quiz spam for non-retrieval activities
- Use `offlineMode` config when `interactionMode !== "digital"`

---

## How rendering works

`ActivityRenderer.tsx` checks `isActivitySpec(definition)` first. If the definition has `schemaVersion === "2"`, it routes to `ActivitySpecRenderer`.

`ActivitySpecRenderer`:
1. Renders header (title, purpose, activity kind badge, interaction mode, time estimate).
2. Shows offline mode panel if `interactionMode !== "digital"`.
3. Renders each component in order via `ComponentRegistry.renderComponent`.
4. Tracks evidence in a `Record<componentId, value>` state map.
5. Shows progress bar for interactive component completion.
6. Shows teacher support panel (collapsible) for parent-facing guidance.
7. Calls `onSubmit(evidence)` on completion; evidence is serialized to the autosave/submit API.

The `ComponentRegistry` maps each `ComponentSpec.type` to its renderer. Adding a new component type requires: a Zod config schema in `components.ts`, a renderer in the appropriate file, and a registry entry in `ComponentRegistry.tsx`.

Legacy v1 activities (quiz, matching, flashcards, etc.) continue to render through the old per-kind renderers. No v1 data is broken.

---

## How evidence and progress mapping work

### Evidence
Each submitted activity produces a structured `evidence` record (`Record<componentId, value>`), stored in `activity_attempts.responses` as JSON. The new `activity_evidence` table (added by migration `0003_structured_activity_runtime.sql`) provides normalized evidence records linked to:
- learner, activity, attempt, lesson session
- `componentId` and `componentType`
- `evidenceKind` (e.g., `answer_response`, `reflection_response`, `confidence_signal`)
- `linkedObjectiveIds` and `linkedSkillIds`

### Progress mapping
The `interpretScore` function in `scoring.ts` maps evidence to `ProgressSignal` using the activity's `scoringModel.mode`:

| Mode | Signal source | Progress outcome |
|------|--------------|-----------------|
| `correctness_based` | Graded answers | mastered / progressing / needs_review |
| `completion_based` | Submission | completed_no_score |
| `rubric_based` | Rubric scores | mastered or needs_review |
| `teacher_observed` | Teacher action | evidence_pending |
| `confidence_report` | Learner confidence | progressing or needs_review |
| `evidence_collected` | Any submission | evidence_pending |

`evidence_pending` and `needs_review` states produce review queue items. Mastered/progressing states feed skill state updates in `curriculumRouting`. The existing `reportOutcome` path in `session-service.ts` handles this flow unchanged.

---

## Why this was a rewrite instead of a compatibility-first migration

The old system had fundamental architectural mismatches with the goals:

1. **Kind == UI shape**: `guided_practice` was both a learning intent AND a specific 3-step form. There was no way to add diverse components without adding new kinds.
2. **Fixed blueprints**: Every activity was generated deterministically from `workflowMode + planItem.kind`. No AI, no lesson context, no curriculum context.
3. **No offline support**: The types didn't model offline activities; they only supported specific screen-based form patterns.
4. **Evidence = score only**: Progress was inferred from `scorePercent` alone. No confidence signals, rubric levels, or evidence-pending states.

A compatibility layer would have required preserving all old kind-specific code, adding adapter logic for every new component type, and maintaining two generation paths. The cutover cost is lower — old data stays queryable; new activities use a cleaner model.

---

## DB changes

### New enum value
`interactive_activity_type` now includes `activity_spec`. New activities are created with this type. Old values remain valid.

### New table: `activity_evidence`
Normalized evidence records. Created by migration `0003_structured_activity_runtime.sql`.

### Preserved tables
`interactive_activities`, `activity_attempts`, `activity_standards` — unchanged. Old activities remain accessible.

---

## Remaining limitations / next recommended steps

1. **Evidence persistence from submissions**: `session-service.ts` creates progress records but does not yet write to `activity_evidence`. The evidence table exists; the write path should be added in `reportOutcome`.

2. **AI generation is blocking**: `generateActivitySpecForPlanItem` calls AI synchronously in the assignment service. For large daily plan hydrations this could be slow. Recommend moving to an Inngest background job pattern.

3. **No v1 → v2 migration script**: Existing blueprint activities in `interactive_activities` remain as-is. If you want to regenerate them with AI-driven specs, add a migration job that:
   - Lists all blueprint activities (`schemaVersion = "1"`)
   - Regenerates them from the plan item context
   - Updates the record with the new spec

4. **Component renderers for `label_map` and `hotspot_select`** require image URLs from the generation output. The model is prompted to include them, but fixtures don't have live URLs. These components render correctly but display broken images in local dev without real URLs.

5. **`ActivitySession.definition` type**: The session service stores `ActivitySpec` as `ActivitySession["definition"]` which is typed as `ActivityDefinition` (the old union). This works at runtime but requires `as unknown as ActivitySession["definition"]` casts. A v2 session type with `spec: ActivitySpec` would be cleaner.

6. **Template hints**: The `templateHint` field (`exploratory`, `practice_heavy`, etc.) is defined and passed to generation but not yet exposed in the parent UI as a generation option. Adding a UI for parents to select activity shape would complete this.
