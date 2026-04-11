# Lesson-First Activity Generation

## What changed

Activity generation was previously plan-item-first: the primary content source was a `PlanItem` object (title, objective, subject, materials). The lesson session was used only as a persistence link.

After this refactor, activity generation is **lesson-session-first, plan-item-second**:

- When a `StructuredLessonDraft` is available in the workspace, it is the primary generation input.
- The plan item is used for scope narrowing (identifying which skill within the lesson the activity targets), curriculum linkage, and subject classification.
- When no lesson draft exists, generation falls back to the plan-item-only path — behavior is identical to before.

## Why the old plan-item-first flow was insufficient

A `PlanItem` carries only a title, a one-line objective, and a list of material strings. It knows nothing about:

- The lesson's block sequence (warm-up, modeling, practice, reflection)
- How the teacher intends to structure the session
- The lesson's success criteria (concrete, observable mastery signals)
- Adaptations for struggles or early finishers
- Assessment artifacts expected at the end

Activities generated from plan items were therefore generic skill-exercises, not shaped by the actual lesson design. A lesson that uses a guided_practice → reflection block structure should produce an activity with build_steps or construction_space + reflection_prompt, not a generic text_response + confidence_check.

## The new lesson-first generation contract

```
StructuredLessonDraft              → primary content source
  title, lesson_focus              → activity title, purpose
  primary_objectives               → lessonObjectives in prompt
  success_criteria                 → mastery indicators in teacherSupport
  blocks[]                         → shape activity interaction pattern
  materials                        → materialsAvailable in prompt
  teacher_notes                    → setup context in teacherSupport
  adaptations                      → extension ideas, struggle hints
  assessment_artifact              → evidence schema hint

PlanItem (optional, scope context)
  title                            → scope label, linkedSkillTitles
  subject                          → curriculumSubject
  sourceLabel                      → curriculum.sourceTitle
  lessonLabel                      → lesson breadcrumb
  id                               → scope.planItemId
```

The `ActivityGenerationContext` now has an optional `lessonDraft: LessonDraftContext` field containing this compact representation of the lesson draft.

## ActivityScope

Activities now carry an explicit scope relative to the lesson session:

| Scope kind         | Meaning                                       |
|--------------------|-----------------------------------------------|
| `session`          | Covers the whole lesson session               |
| `route_item`       | Scoped to a specific curriculum skill/item    |
| `lesson_block`     | Targets a named block in the lesson           |
| `objective_cluster`| Targets a group of objectives                 |

When a plan item is provided, the scope defaults to `route_item`. Without a plan item, it defaults to `session`.

The scope is passed through to the prompt so the model can design the activity to target the appropriate part of the lesson.

## How item scoping works now

`buildContextFromLessonSession()` receives a plan item as `planItem?`. When present:

1. `scope.kind = "route_item"` with `scope.planItemId = planItem.id`
2. The model is instructed to "design this activity to target the scoped skill/topic within the broader lesson"
3. `linkedSkillTitles` includes the plan item's title
4. Subject and curriculum source come from the plan item

The activity is still *downstream of the lesson design* — the lesson draft's block sequence, success criteria, and teacher notes shape the interaction pattern. The plan item just narrows the focus.

## Persistence / reporting implications

The `interactive_activities` table was not changed. Persistence remains:
- `lessonSessionId` — primary parent (unchanged)
- `planItemId` — secondary scope reference (unchanged)

The `metadata` column now includes `lessonDraftUsed: boolean` to distinguish which generation path was used.

Evidence → lessonSession → objective → curriculum skill rollup is unaffected.

## Files changed

| File | Change |
|------|--------|
| `lib/activities/generation-context.ts` | Added `LessonDraftContext`, `ActivityScope`, `buildContextFromLessonSession()`, `extractLessonDraftContext()` |
| `lib/activities/generation-service.ts` | Added `generateActivitySpecForLessonSession()` as primary entry; `generateActivitySpecForPlanItem()` retained as fallback |
| `lib/activities/assignment-service.ts` | `publishActivitySpecForItem()` accepts `lessonDraft?`; routes to lesson-first generation when present |
| `lib/prompts/activity-spec.ts` | `ActivitySpecPromptInput` adds `lessonDraft?`, `scope?`; prompt updated to guide lesson-aware activity design; prompt version bumped to `2.0.0` |
| `app/(parent)/today/actions.ts` | Both server actions pass `workspace.lessonDraft?.structured` to publishing and preview |
| `lib/activities/index.ts` | Exports new public API |
| `scripts/activity-spec.test.mts` | 8 new tests covering lesson-first context building |

## Remaining limits / next recommended steps

1. **One lesson draft per source** — the current workspace shape stores one lesson draft per `sourceId`. If multiple curriculum sources are loaded in a single day, only one draft is available. This is a workspace-design limit, not a generation limit.

2. **Lesson draft is required for lesson-first** — if the parent hasn't generated a lesson draft yet, generation falls back to plan-item-only. A future improvement would generate a lesson draft on-demand before activity generation, or trigger a draft at workspace load.

3. **Block-level scope not yet wired in UI** — the `lesson_block` scope kind is defined but the Today UI doesn't expose block selection. Activities are currently scoped to `route_item` or `session`. Block-level targeting would require a lesson panel UI component.

4. **Multiple activities per session not yet modeled in UI** — the architecture supports multiple activities per lesson session (different scopes), but the Today workspace currently shows one activity per plan item. The rendering layer needs to be updated if you want to expose this.
