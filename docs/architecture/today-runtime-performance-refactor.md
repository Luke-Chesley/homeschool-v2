# Today Runtime Performance Refactor

## Scope

This refactor keeps Today behavior, learning-core contracts, and business rules intact while changing how Today reads, materializes, invalidates, and patches UI state.

## Old Flow

1. `/today` could execute mutations from query params in `app/(parent)/today/page.tsx`.
2. Reading Today implicitly performed materialization and extra sync work through `getTodayWorkspace(...)`.
3. Small Today interactions often resolved correctness by calling `router.refresh()`.
4. Lesson and activity generation status updates were recovered by polling the full route every 2 seconds.
5. Item evaluation writes reopened Today workspace state to rediscover IDs already known by the client.
6. Small per-card writes fanned out into broad route revalidation, including `/tracking` and `/tracking/reports`.

## New Flow

1. `/today` is read/render only. Query params support date deep-linking, not action mutation.
2. Today materialization is explicit through `materializeTodayWorkspace(...)`.
3. Today read/render is explicit through `getTodayWorkspaceView(...)`.
4. Item actions and evaluations return patch payloads so the client updates affected cards locally.
5. Lesson/activity generation status is read through narrow status endpoints:
   - `/api/today/lesson-build-status`
   - `/api/today/activity-build-status`
6. Full route refresh is reserved for structural changes that truly require it, and even those actions now prefer returning a fresh workspace patch for the Today shell.

## Removed `router.refresh()` Usages

- `components/planning/lesson-plan-panel.tsx`
  - Removed refresh after successful lesson generation.
  - Removed refresh after failed lesson generation.
  - Removed the 2-second full-route refresh loop used while lesson generation was in flight.
  - Removed refresh after regeneration-note save.
  - Removed refresh after expansion-intent save.
  - Removed refresh after route expansion.

- `components/planning/today-workspace-view.tsx`
  - Removed refresh after activity generation success.
  - Removed refresh after activity generation failure.
  - Removed the 2-second full-route refresh loop used while activity generation was in flight.
  - Removed refresh after per-item completion/partial/skip/repeat/swap actions.
  - Removed refresh after item evaluation save.
  - Removed refresh after lesson outcome evaluation save.

## Narrowed `revalidatePath(...)` Usage

Current Today action revalidation in `app/(parent)/today/actions.ts`:

- `/today`
  - `updateTodayPlanItemAction`
  - `saveTodayPlanItemEvaluationAction`
  - `generateLessonDraftActivityAction`
  - `saveLessonRegenerationNoteAction`
  - `saveExpansionIntentAction`
  - `expandTodayRouteAction`

- `/planning`
  - `expandTodayRouteAction` only, because route expansion changes planning structure beyond the Today shell.

Removed broad revalidation for small Today writes:

- `/planning` from per-card actions and evaluations
- `/tracking`
- `/tracking/reports`

## Materialization Path Before / After

### Before

- `getTodayWorkspace(...)`
  - materialized Today state
  - synced plan items
  - assembled render state
  - could trigger extra write-oriented sync while serving the route

Result: rendering `/today` could secretly perform heavy synchronization work, and actions often reopened the workspace to recover data needed for writes.

### After

- `materializeTodayWorkspace(...)`
  - explicit write-allowed materialization/sync step

- `getTodayWorkspaceView(...)`
  - read-only view assembly
  - no hidden write-oriented session sync on the render path

- `getTodayWorkspace(...)`
  - compatibility wrapper only
  - now composes `materializeTodayWorkspace(...)` then `getTodayWorkspaceView(...)`

Result: the Today page can materialize once at a bounded point, then read a stable view model without paying the full sync cost again for every small interaction.

## Interaction Model Changes

- Item cards now carry durable Today IDs (`planParentId`, `planDayRecordId`, `planRecordId`, `sessionRecordId`) so write actions do not need to reopen the workspace to rediscover them.
- `updateTodayPlanItemAction(...)` returns either:
  - an `itemPatch` for local card updates, or
  - a `workspacePatch` when the change is structural enough to reshape the Today list.
- `saveTodayPlanItemEvaluationAction(...)` returns an `itemPatch` for local evaluation state updates.
- `generateLessonDraftActivityAction(...)` returns activity state directly for local patching.
- Lesson and activity build progress now flow through small status reads keyed by date and route/build fingerprint instead of full Today rerenders.

## `syncTodayPlanItems(...)` Improvement Summary

The sync path now reduces obvious serial work by:

- building bulk maps of existing links and plan items up front
- batching inserts for missing plan items
- updating existing plan items in parallel where safe
- creating missing curriculum links in batch
- reducing repeated read-after-write lookups
- isolating `ensureSessionWorkspace(...)` so surrounding DB reads are not repeated per item
- hydrating sessions, evidence, and activity counts in batched passes

## Expected Runtime Effect

- Small Today interactions should update in place without a page flash.
- Lesson/activity generation keeps polling, but only through narrow status payloads.
- Today render remains functionally equivalent while doing less hidden work on both phone and desktop.
