# Weekly Planning Day Selection Fix

## Problem

Three related bugs prevented weekend scheduling from working correctly:

1. **`buildSuggestedScheduledDates` used `.slice(0, N)`** — treated "first N days of the week" as the planning window instead of using the exact day offsets the learner has enabled. A Mon/Wed/Fri schedule or a Tue/Thu/Sat schedule would both be silently rewritten to Mon/Tue/Wed.

2. **`getPlanningDayCount` miscounted array-format `planningDays`** — `.filter(v => v != null)` counted `false` entries as enabled days. A profile with `[true, false, false, false, false, false, false]` (Mon only) would return 7.

3. **`WEEKDAY_COUNT = 5` in `weekly-route-service.ts`** — the board display, auto-schedule fill, and manual drag validation were all hard-wired to Monday–Friday. Dropping an item onto Saturday or Sunday threw an error; `ensureSuggestedWeeklyRouteSchedule` could only fill Mon–Fri slots.

## Design

Two responsibilities are now explicitly separated:

- **Visible week span** — always 7 days (Mon–Sun). `buildWeekdayDates` and `buildPlanningWeekdayDates` return all seven dates; the board renders all seven columns.
- **Auto-schedule days** — the exact set of enabled offsets from the learner's `planningDays` profile. Defaults to Mon–Fri `[0,1,2,3,4]` when no profile exists.

## New helper: `lib/curriculum-routing/planning-days.ts`

`getEnabledPlanningDayOffsets(planningDays)` is the single source of truth for converting raw `planningDays` JSON into a sorted list of day offsets (0 = Monday … 6 = Sunday). It handles both storage formats:

- **Array**: `[true, false, true, false, true, false, false]` — index is the day offset
- **Object**: `{ "0": true, "2": true, "4": true }` — key is the day offset

If the resolved set is empty (null / undefined / all-false), it falls back to `[0,1,2,3,4]` so auto-scheduling is never completely blocked by a bad profile value.

## Changes

### `lib/curriculum-routing/service.ts`

- `buildSuggestedScheduledDates` now accepts `enabledDayOffsets: number[]` and maps them to actual dates before distributing items. Items beyond the available days get `null` (queued, not scheduled).
- `getPlanningDayCount` array branch now uses `.filter(Boolean)` instead of `.filter(v => v != null)`.
- `buildRecommendations` computes `enabledDayOffsets` via `getEnabledPlanningDayOffsets` and threads it through the return value and `generationBasis` log.
- `persistGeneratedRoute` accepts `enabledDayOffsets` instead of `planningDayCount`.

### `lib/planning/weekly-route-service.ts`

- `WEEKDAY_COUNT` changed from `5` to `7`.
- `ensureSuggestedWeeklyRouteSchedule` loads the learner's route profile and calls `getEnabledPlanningDayOffsets` to filter which of the 7 week dates are open for auto-filling.
- Manual move validation (`moveWeeklyRouteItem`) now accepts any of the 7 dates as a valid target column. The "Monday-Friday" error message is gone.

## Backward compatibility

- Profiles with no `planningDays` get the same Mon–Fri behaviour as before.
- Existing routes with manually pinned Saturday/Sunday dates were previously blocked from drag-and-drop; they now move freely.
- The board always shows 7 columns regardless of the learner's planning day selection.
