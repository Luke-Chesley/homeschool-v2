# Lesson-Draft-Owned Activity Generation

## What changed

Activity generation was refactored so that the **lesson draft** is the canonical parent of each activity, replacing the previous model where plan items (skills) were the implicit generation unit.

### Files changed

| File | Change |
|------|--------|
| `lib/lesson-draft/fingerprint.ts` | **NEW** — deterministic content fingerprint for lesson drafts |
| `lib/db/schema/activities.ts` | Added `lessonDraftFingerprint` column to `interactiveActivities` |
| `drizzle/0004_lesson_draft_ownership.sql` | **NEW** — migration for `lesson_draft_fingerprint` column |
| `lib/db/repositories/activities.ts` | Added `findActivityForLessonDraft`, `findPublishedActivityForSession`, `archiveActivitiesForSession` |
| `lib/activities/generation-context.ts` | Added `buildActivityContextFromLessonDraft` as canonical primary builder |
| `lib/activities/generation-service.ts` | Added `generateActivitySpecForLessonDraft` as canonical entry point |
| `lib/activities/assignment-service.ts` | Added `publishActivityForLessonDraft`; refactored `ensurePublishedActivitiesForLearner` |
| `app/(parent)/today/actions.ts` | Added `generateLessonDraftActivityAction`, `getLessonDraftActivityStatusAction`, `getLessonDraftPromptPreviewAction` |
| `components/planning/today-workspace-view.tsx` | Moved activity control to lesson draft area; removed from plan item cards |
| `scripts/activity-spec.test.mts` | Added 12 tests for the new hierarchy |

---

## Why skill/item-first activity generation was wrong

The previous architecture had the correct _content_ source (lesson draft was already used to build the generation context), but the _ownership_ model was still plan-item-shaped:

1. **UI trigger was per-plan-item card.** If a session had 3 items, the user could generate 3 separate activities — one per item. This implied a 1:1 item→activity relationship that contradicted the lesson-draft-first design intent.

2. **`ensurePublishedActivitiesForLearner` looped over plan items**, calling `publishActivitySpecForItem` for each. One session → multiple activities.

3. **Dedup used `listActivitiesForPlanItem`**, keying uniqueness to the plan item record ID. Two different lesson drafts that included the same plan item could silently reuse each other's activities.

4. **No lesson draft identity/version.** There was no fingerprint or version on the draft itself, so there was no way to detect when the draft changed after an activity was generated.

5. **Naming encoded the wrong hierarchy.** `publishActivitySpecForItem`, `generateActivitySpecForPlanItem`, `getActivityPromptPreviewAction(itemId, date)` all implied item-first ownership.

---

## The new hierarchy

```
curriculum
  └── lesson draft (unique content identity via fingerprint)
        └── one lesson activity (primary artifact)
              └── evidence / progress
                    └── mapped to objectives / curriculum skills (traceability)
```

### Lesson draft identity

Each `StructuredLessonDraft` now has a **content fingerprint** computed by `computeLessonDraftFingerprint()`:

- SHA-256 hash of content-bearing fields (title, focus, objectives, success criteria, blocks, materials, adaptations, lesson shape, assessment artifact)
- Truncated to 16 hex characters for storage efficiency
- Excludes metadata fields (`savedAt`, `promptVersion`) so re-saves without content changes are stable
- Different lesson drafts always produce different fingerprints, even if skill overlap exists

### Activity ownership

- `interactiveActivities.lessonSessionId` — primary ownership anchor (lesson session for the lead item)
- `interactiveActivities.lessonDraftFingerprint` — identifies which draft version produced this activity
- `interactiveActivities.planItemId` — optional; traceability only (lead item for DB integrity)

### Stale detection

When a new lesson draft is generated (or edited), its fingerprint changes. On the next generation request:

1. `findPublishedActivityForSession(sessionId)` — find existing activity
2. Compare `existingActivity.lessonDraftFingerprint` with current fingerprint
3. If mismatch → `archiveActivitiesForSession(sessionId)` (mark stale), then generate fresh

The UI shows an "Activity is stale" warning with a "Regenerate activity" button.

---

## How UI now reflects lesson ownership

The `GenerateActivityButton` was removed from individual plan item cards. Instead:

- `LessonDraftActivityControl` is placed in the `TodayLessonDraftArticle` section
- Shows the activity state: no draft / no activity / ready / stale
- "Generate activity" creates one activity for the whole lesson draft
- "Regenerate activity" archives the stale activity and generates a new one
- "Open activity" navigates to the activity using the lead session ID

Plan item cards no longer show per-item activity counts or generation controls. They show evidence count only (which rolls up from the activity).

---

## How evidence/progress still maps back to objectives/skills

The activity spec retains `linkedObjectiveIds` and `linkedSkillLabels`, which are populated from the plan items' skill titles in `buildActivityContextFromLessonDraft`. These appear in:

- `activityEvidence.linkedObjectiveIds` — per-evidence traceability
- `activityEvidence.linkedSkillIds` — per-evidence traceability
- `interactiveActivities.masteryRubric.linkedObjectiveIds` — activity-level summary
- `interactiveActivities.metadata.linkedSkillLabels` — full skill list for reporting

The reporting chain is: activity evidence → activity (lessonDraftFingerprint) → lesson session → objectives/skills.

---

## Remaining limits / next recommended steps

1. **`LessonDraftActivityControl` initial state is always `null`** — the UI renders with `activityStatus={null}`, which means the generate/open state is not immediately shown on page load. To fix this, the page server component should call `getLessonDraftActivityStatusAction(date)` and pass the result as props to `TodayWorkspaceView` / `TodayLessonDraftArticle`.

2. **Legacy activities (no fingerprint)** have `lessonDraftFingerprint = NULL`. The `findPublishedActivityForSession` query returns them, and the fingerprint comparison treats `NULL !== currentFingerprint` as stale. This will prompt one-time regeneration for all legacy sessions. This is correct behavior — legacy activities will be replaced with lesson-draft-owned ones on the next generation.

3. **`ensurePublishedActivitiesForLearner` fallback** still creates one activity per plan item when no lesson draft is present. This is intentional — the item-first fallback remains valid when no draft exists. Once a draft is generated, the lesson-draft path takes over.

4. **Activity runtime link** (`/activity/[sessionId]`) uses the lead item's session ID. If the lesson covers multiple plan items, all items resolve to the same activity via the lead session. Long-term, a dedicated lesson session record (not tied to a single plan item) would clean this up.

5. **`DailyWorkspaceLessonDraft.routeFingerprint`** (the existing field on the draft metadata) is a route fingerprint (`itemIds.join("::")`) — not the same as the new content fingerprint. These serve different purposes and should not be confused. The route fingerprint identifies _which items are in the route_; the content fingerprint identifies _what the draft says_.
