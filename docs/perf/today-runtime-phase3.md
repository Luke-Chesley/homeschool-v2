# Today Runtime Phase 3

## Goal

Harden the Today runtime so the steady-state `/today` path stays read-first, small helper reads stay narrow, and client actions do not pay for route-wide invalidation or inline workspace rematerialization.

## What To Measure

Capture both outer request timings and inner Today service timings.

Outer timings:

- browser navigation timing for `/today?date=YYYY-MM-DD`
- Next dev request timing for `/today`
- `Server-Timing` header for `/api/today/workspace-patch`
- `Server-Timing` header for `/api/today/build-status`

Inner timings from `[today-runtime]` logs:

- `resolveTodayWorkspaceContext`
- `resolveTodayWeeklyRouteBoard`
- `resolveTodayCurriculumNodes`
- `readTodayWorkspaceFreshnessState`
- `materializeTodayWorkspace`
- `syncTodayPlanItems`
- `getTodayWorkspaceView`
- `getTodayWorkspaceViewForRender`
- `getTodayBuildStatus`

Also capture:

- `selectedRouteItemCount`
- `createdItemCount`
- `updatedItemCount`
- `ensuredSessionCount`
- `canonicalReload`

## How To Profile `/today`

1. Start local dev:

```bash
cd /home/luke/Desktop/learning/homeschool-v2
corepack pnpm dev
```

2. Sign in with the seeded local parent account:

- email: `qa.single.parent.local+01@example.com`
- password: `LocalPass123!`

3. Use a populated day so Today has route-backed items:

- profiled local date: `2026-04-15`

4. Record:

- first populated `/today?date=2026-04-15` hit after compile
- one repeated warm hit on the same date
- one `/api/today/workspace-patch?date=2026-04-15` follow-up

5. Verify at least one local action without leaving persistent drift:

- `Mark done`
- `Undo`

For the no-flash check, compare `performance.timeOrigin` before and after the action.

## How To Profile Build Status

1. Reuse the authenticated browser session from the `/today` run.
2. Read `/api/today/workspace-patch?date=2026-04-15` once to capture:

- `sourceId`
- `routeFingerprint`

3. Fetch:

```text
/api/today/build-status?date=2026-04-15&sourceId=...&routeFingerprint=...
```

4. Record:

- `Server-Timing`
- `lessonBuild.status`
- `activityBuild.status`
- `activityState.status`
- inner `getTodayBuildStatus` log timing

Use the second request as the warm comparison if the first one also compiles the route handler in dev.

## Before / After Notes

Baseline from the prior Phase 2 note in `docs/architecture/today-runtime-hardening-phase2.md`:

- populated `/today?date=2026-04-15`
  - Next dev request: `233ms`
  - inner `getTodayWorkspaceViewForRender`: `74.1ms`
- warm `/api/today/workspace-patch`
  - `Server-Timing`: `102.6ms`
  - inner `getTodayWorkspaceViewForRender`: `20.7ms`
- warm `/api/today/build-status`
  - `Server-Timing`: `35.5ms`
  - inner `getTodayBuildStatus`: `1.4ms`

Phase 3 local profiling on `2026-04-17`:

- first stale `/today` hit on a newly created household during the earlier local onboarding pass
  - Next dev request: `627ms`
  - repeated warm hits immediately after: `78ms`, then `74ms`
- warm populated `/today?date=2026-04-15`
  - Next dev request: `236ms`
  - browser nav: `DOMContentLoaded 534.5ms`, `load 949.5ms`
  - inner timings:
    - `resolveTodayWorkspaceContext`: `45.6ms`
    - `resolveTodayWeeklyRouteBoard`: `13.6ms`
    - `readTodayWorkspaceFreshnessState`: `1.8ms`
    - `getTodayWorkspaceView`: `12.4ms`
    - `getTodayWorkspaceViewForRender`: `60.3ms`
- warm `/api/today/workspace-patch?date=2026-04-15`
  - observed `Server-Timing`: `59.7ms`, `113.0ms` in repeated dev-mode runs
  - warm inner timings:
    - `resolveTodayWorkspaceContext`: `9.4ms`, then `17.6ms`
    - `readTodayWorkspaceFreshnessState`: `1.9ms`
    - `getTodayWorkspaceView`: `8.1ms`, then `7.8ms`
    - `getTodayWorkspaceViewForRender`: `19.6ms`, then `27.6ms`
- warm `/api/today/build-status?...`
  - observed `Server-Timing`: `44.3ms` on the repeated warm request
  - warm inner timings:
    - `getTodayBuildStatus`: `5.0ms`, then `2.0ms`

Interpretation:

- the Today render path stays read-first on warm hits; the freshness check is now visible as its own low-cost step instead of being buried in the full render timing
- request-local work is now easier to compare because route-board resolution, freshness, view assembly, and build-status reads each log separately
- the biggest remaining warm-read cost is still route-board/context assembly, not materialization or the narrow helper endpoints
- dev-mode `Server-Timing` remains noisy, so compare the inner `[today-runtime]` timings first and treat outer request timings as directional

## Manual Verification Notes

Local browser verification on `2026-04-17`:

- `Mark done` then `Undo` on `/today?date=2026-04-15`
- `performance.timeOrigin` stayed constant before, after complete, and after undo
- URL stayed on `/today?date=2026-04-15`
- no `/api/today/workspace-patch` or `/api/today/build-status` fetch was triggered by the non-structural complete/reset flow
- `Evaluate` on `/today?date=2026-04-15`
- `performance.timeOrigin` stayed constant through save
- the saved evaluation note appeared in `/tracking`
- `Push forward` on `/today?date=2026-04-16`
- `performance.timeOrigin` stayed constant and the only narrow follow-up was `/api/today/workspace-patch?date=2026-04-16`
- the moved item rendered on `/today?date=2026-04-17`
- `Mark partial` on `/today?date=2026-04-17`
- `performance.timeOrigin` stayed constant
- `/tracking` reflected the carried-forward work as increased `Needs attention`
- `Skip today` on the plain single-learner card at `/today?date=2026-04-16`
- `performance.timeOrigin` stayed constant and `/api/today/workspace-patch?date=2026-04-16` was the only follow-up helper read
- the day shell updated to the empty-state copy without a document reload
- `Repeat tomorrow` on `/today?date=2026-04-15` for the multi-learner route fixture
- `performance.timeOrigin` stayed constant, the success message rendered locally, and `/today?date=2026-04-16` showed the repeated item
- `Lighter option` on the same route fixture
- `performance.timeOrigin` stayed constant and the card updated through a narrow workspace patch
- `Expand to current week` on the same route fixture
- `performance.timeOrigin` stayed constant, the success message rendered in Today, and `/planning/day/2026-04-16` showed the newly scheduled route item
- `Generate` on `/today?date=2026-04-16` for the expanded route fixture
- combined `/api/today/build-status` polling count: `5`
- legacy `/api/today/lesson-build-status` polling count: `0`
- legacy `/api/today/activity-build-status` polling count: `0`
- polling stopped after the activity became ready

That confirms the hardened runtime behavior end to end:

- warm `/today` hits stay read-first instead of rematerializing the workspace every time
- simple card writes stay local and do not hit route-wide invalidation
- structural writes return immediately, then reconcile through the narrow workspace patch path
- lesson and activity status both flow through the combined build-status endpoint rather than the legacy split pollers
