# Today Runtime Hardening: Phase 2

## Goal

Take the refactored Today runtime from "better" to "actually fast" without changing product behavior, onboarding, auth contracts, or `learning-core`.

## Old vs Hardened Flow

### Before this pass

`/today` still did the expensive path by default:

1. resolve Today context
2. materialize Today workspace every request
3. resolve Today context again while building the view
4. poll lesson and activity independently every 2 seconds from separate client loops
5. wait for structural actions to finish materialize + full workspace patch generation inline

`syncTodayPlanItems(...)` also updated too many rows:

- existing plan items were updated even when the canonical fields were unchanged
- `updatedAt` churned on no-op updates
- canonical link / plan-item rereads happened on every sync
- `ensureSessionWorkspace(...)` ran for every selected item even when a session already existed for the day

### Hardened flow

The Today path now prefers a read-only render:

1. resolve Today context once per request path via `cache(...)`
2. read stored Today metadata + freshness marker
3. if freshness matches `organizationId + learnerId + date + sourceId + routeFingerprint + itemCount`, render read-only
4. only materialize when the workspace is missing or stale
5. build the view from the already-resolved context without recomputing route context

Client behavior now uses one narrow status/read channel:

- one combined `/api/today/build-status` endpoint for lesson + activity state
- one backoff poller at `1s -> 2s -> 4s -> 4s...`
- one `/api/today/workspace-patch` endpoint for post-structural-action reconciliation
- structural actions return immediately with an optimistic local patch and trigger background reconciliation instead of blocking on inline materialization

## What Makes A Plan Item "Dirty"

`syncTodayPlanItems(...)` now updates an existing `plan_items` row only when one or more of these fields changed:

- `planId`
- `planDayId`
- `curriculumItemId`
- `title`
- `description`
- `subject`
- `status`
- `scheduledDate`
- `estimatedMinutes`
- `ordering`
- metadata subset:
  - `sourceLabel`
  - `lessonLabel`
  - `weeklyRouteItemId`
  - `skillNodeId`

No-op rows now skip the update entirely, including `updatedAt`.

## Polling / Action Model

- `components/planning/lesson-plan-panel.tsx` no longer owns a lesson polling loop.
- `components/planning/today/activity-build-control.tsx` no longer owns an activity polling loop.
- `components/planning/today/use-today-build-status-polling.ts` owns the single combined poll loop.
- Structural item actions (`partial`, `push_to_tomorrow`, `skip_today`, `swap_with_alternate`) now:
  - return immediately
  - apply an optimistic remove patch locally
  - fetch `/api/today/workspace-patch` in the background for authoritative reconciliation

## Local Profiling Notes

Environment:

- local dev server at `http://127.0.0.1:3001`
- seeded account: `single_learner_parent_seed`
- populated Today date found during profiling: `2026-04-15`

Warm local measurements after Next.js route compilation:

- `/today?date=2026-04-15`
  - browser navigation timing: `DOMContentLoaded 241.9ms`, `load 519.9ms`
  - Next dev request log: `GET /today?date=2026-04-15 200 in 233ms`
  - service logs:
    - `resolveTodayWorkspaceContext`: `58.8ms` on the page request
    - `getTodayWorkspaceView`: `11.8ms`
    - `getTodayWorkspaceViewForRender`: `74.1ms`
- `/api/today/workspace-patch?date=2026-04-15`
  - `Server-Timing`: `today-workspace-patch;dur=102.6`
  - service logs on the warm follow-up:
    - `resolveTodayWorkspaceContext`: `12.0ms`
    - `getTodayWorkspaceView`: `6.6ms`
    - `getTodayWorkspaceViewForRender`: `20.7ms`
- `/api/today/build-status?...`
  - `Server-Timing`: `today-build-status;dur=35.5`
  - service log:
    - `getTodayBuildStatus`: `1.4ms`

Materialization on the populated day only happened when the freshness check missed:

- `syncTodayPlanItems`: `16.0ms`
- `materializeTodayWorkspace`: `19.4ms`
- sync summary on that run:
  - `selectedRouteItemCount: 1`
  - `createdItemCount: 0`
  - `updatedItemCount: 1`
  - `ensuredSessionCount: 0`
  - `canonicalReload: false`

Interpretation:

- the expensive work is no longer paid on every Today read
- the combined build-status path is now materially narrower than a full workspace reread
- `syncTodayPlanItems(...)` is avoiding session churn on warm reads and only touched one truly dirty item on the stale materialization run

## Remaining Bottlenecks

- `getOrCreateWeeklyRouteBoardForLearner(...)` plus route-board reconstruction still dominates populated-day context resolution.
- Next dev middleware/auth/runtime overhead is still larger than the inner service timings, especially on first requests after inactivity.
- `TodayWorkspaceView` is now much smaller, but the top-level Today state boundary is still client-owned because item actions and live build patching share one local workspace state.
- Legacy `/api/today/lesson-build-status` and `/api/today/activity-build-status` routes still exist for compatibility, even though the Today UI now uses the combined endpoint.
- First stale hits still pay materialization by design; the improvement is that fresh reads and narrow status checks no longer do.
