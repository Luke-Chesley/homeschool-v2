# Curriculum–Lesson Timing Reconciliation

## Root Cause

Three disconnected defaults were silently competing:

1. **Curriculum generation** produces `pacing.sessionMinutes` (e.g. 30 min/session).
2. **Normalization** (`lib/curriculum/normalization.ts`) sets `estimatedMinutes: null` on all skill nodes — timing never reached the node layer.
3. **Planning** (`today-service.ts`) used `node?.estimatedMinutes ?? 45` — the `null` node always triggered the `45` fallback.
4. **Lesson-draft generation** (`app/api/ai/lesson-plan/route.ts`) computed `totalMinutes` by summing plan-item `estimatedMinutes`. With three items × 45 = 135 minutes even though the curriculum said 30.

Result: curriculum could say 30-minute sessions; lesson drafts received 135 minutes.

## New Canonical Timing Contract

**File:** `lib/planning/session-timing.ts`

```
resolveLessonSessionMinutes({ sourceSessionMinutes, lessonOverrideMinutes? })
  → LessonTimingContract { resolvedTotalMinutes, timingSource, ... }
```

Precedence (highest → lowest):

| Priority | Source | Field |
|---|---|---|
| 1 | Explicit lesson/node override | `lessonOverrideMinutes` |
| 2 | Curriculum source pacing | `sourceSessionMinutes` (from `CurriculumSource.pacing.sessionMinutes`) |
| 3 | System fallback | `LESSON_SESSION_FALLBACK_MINUTES = 45` |

Only reach priority 3 when the source has no pacing data at all. Do not scatter the literal `45` anywhere else.

## What Changed in Curriculum Persistence

**`lib/curriculum/types.ts`**
- Added `CurriculumSourcePacingSchema` and `CurriculumSourcePacing` type.
- Added `pacing?: CurriculumSourcePacing` field to `CurriculumSourceSchema` / `CurriculumSource`.

**`lib/curriculum/service.ts`**
- Added `extractSourcePacing(metadata)` helper.
- `mapSource()` now populates `pacing` from `metadata.pacing` (the pacing object written at AI-draft import time via `toImportedCurriculumDocumentFromAiArtifact`).

The `pacing` data has always been persisted in `curriculumSources.metadata.pacing` — it just wasn't surfaced in the TypeScript type or used downstream. No migration needed.

## What Changed in Planning / Session Materialization

**`lib/planning/today-service.ts`**
- `getTodayWorkspace` now calls `resolveLessonSessionMinutes({ sourceSessionMinutes: selectedSource.pacing?.sessionMinutes })` once per workspace load and returns the `sessionTiming: LessonTimingContract` in its result.
- `syncTodayPlanItems`, `buildPlanItem`, `buildWeeklyRouteItem` all accept `sessionBudgetMinutes` and use it:
  - Plan items: `estimatedMinutes = node?.estimatedMinutes ?? sessionBudgetMinutes` (node override wins; otherwise uses session budget as item-effort hint)
  - Session workspace: `scheduledMinutes = sessionBudgetMinutes` (full canonical budget, not per-item)

**`lib/planning/service.ts`**
- `scheduledMinutes` for day constraint now uses `sessionTiming.resolvedTotalMinutes` instead of summing item efforts.

**`app/(parent)/today/page.tsx`**
- The displayed minute count uses `sessionTiming.resolvedTotalMinutes` instead of summing items.

## What Changed in Lesson-Draft Generation

**`lib/ai/task-service.ts`**
- Added `LessonDraftResolvedTiming` interface and `resolvedTiming?: LessonDraftResolvedTiming` field to `LessonDraftInput`.
- `buildLessonDraftPromptPreview` now uses `input.resolvedTiming?.resolvedTotalMinutes` as the primary source of `totalMinutes`. Falls back to `estimatedMinutes` (legacy), then `45`. Never sums route-item efforts.
- `estimatedMinutes` on `LessonDraftInput` is marked `@deprecated` — it remains for old callers but is superseded by `resolvedTiming`.

**`app/api/ai/lesson-plan/route.ts`**
- Removed `workspace.items.reduce(...)` for computing `totalMinutes`.
- Constructs `resolvedTiming` from `workspaceResult.sessionTiming` and passes it directly to `LessonDraftInput`.
- Response summary includes `timingSource` for client-side transparency.

## How Flexibility / Overrides Work

- **Source-level default**: set when the curriculum is generated (AI pacing → `sessionMinutes`). Persists in `curriculumSources.metadata.pacing`.
- **Node-level override**: set `node.estimatedMinutes` on a skill node. Currently only surfaced in `buildPlanItem`/`buildWeeklyRouteItem` as item-effort. To promote a node override to a session budget override, pass it as `lessonOverrideMinutes` to the resolver.
- **Session-level override**: not yet implemented in the UI. When needed, pass an explicit `lessonOverrideMinutes` to `resolveLessonSessionMinutes` and store it in plan-day or lesson-session metadata.

All overrides must pass through `resolveLessonSessionMinutes`. There is no mechanism for overrides to compete silently.

## Session Budget vs Item Effort

These two concepts were blurred before:

| Concept | Meaning | Where it lives |
|---|---|---|
| **Session budget** | How long the whole lesson session should be | `LessonTimingContract.resolvedTotalMinutes`, `lessonSessions.scheduledMinutes` |
| **Item effort** | How much of the session a single route item might take | `PlanItem.estimatedMinutes`, `WeeklyRouteItem.estimatedMinutes` |

Item effort is a hint for UI display (e.g. showing "15 min" next to a skill card). It is not a source of truth for the lesson budget. Summing item efforts does not produce a valid session budget.

## Remaining Limits / Next Steps

1. **Explicit lesson-level override in the UI** — the resolver supports it but the planning UI doesn't expose it yet. Add a "session length override" field to the day or lesson session.
2. **Per-unit or per-day rhythm variations** — the resolver uses a single source default. If different units in a curriculum have different session lengths, expose them as `lessonOverrideMinutes` on the curriculum item and thread them through to the resolver.
3. **Normalization could carry lesson timing** — `normalizeCurriculumDocument` currently sets all nodes to `estimatedMinutes: null`. If you want per-skill timing, populate it in normalization from the lesson outline. Currently not needed since session budget comes from source pacing.
4. **Activity timing downstream** — activities inherit `lessonDraft.total_minutes` which is now correctly set. No second timing mismatch is present.
