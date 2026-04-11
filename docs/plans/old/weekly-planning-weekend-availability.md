# Weekly Planning Weekend Availability

## Summary
Enabled Saturday and Sunday as available planning days in the weekly planning interface and routing logic.

## Changes
- Updated `WEEKDAY_COUNT` from 5 to 7 in `lib/curriculum-routing/service.ts` to support a full 7-day week.
- Updated `components/planning/weekly-route-board.tsx` to render 7 columns instead of 5.
- Maintained default behavior where auto-scheduling and planning day counts default to 5 days (Monday-Friday) unless explicitly configured in the learner's route profile.

## Auto-Scheduling & Defaults
- **Default Behavior**: New or unconfigured learners still default to a 5-day planning week. This ensures that the "out-of-the-box" experience remains weekday-only.
- **Explicit Opt-in**: If a user updates their `planningDays` in their route profile to include weekends, the `getPlanningDayCount` helper will reflect this, and `buildSuggestedScheduledDates` will distribute lessons across the extended set of days.
- **Persistence**: Weekend selections are stored within the `planning_days` metadata column of the `learner_route_profiles` table.

## Edge Cases
- **Existing Plans**: Existing plans that only utilized weekdays continue to function normally as the logic is additive.
- **Date Calculation**: Date offsets are calculated from the week start date, so expanding the count to 7 naturally includes Saturday and Sunday.
