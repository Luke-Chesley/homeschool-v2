# Phase 6 Implementation

## Goal

Turn the bounded route into an explicit parent-approved runway without losing the first-day value moment.

## Current Fit With Repo

- Phase 3 already creates bounded launch depth from `curriculum_generate`.
- Phase 4 and Phase 5 already turn the first scheduled day into a lesson draft plus learner activity.
- Fast-path onboarding currently creates the weekly route too early for stronger inputs: the route is already spread across the week before the parent chooses to expand.
- Phase 5 already stores `keep_today` vs `expand_from_here`, but those controls do not yet change route scheduling.

## Implementation Decision

Phase 6 will not regenerate source content. It will change scheduling behavior.

- onboarding will still create bounded curriculum depth for the chosen horizon
- fast-path onboarding will collapse that route into a one-day launch window:
  - keep today’s first item scheduled
  - keep later items queued
  - remove pre-today placeholders created by week-based scheduling
- Today will expose explicit expansion actions:
  - expand to tomorrow
  - expand to next few days
  - expand to current week
- those actions will schedule already-generated queued route items into future dates without changing today’s current lesson or activity

This keeps weak sources bounded and makes strong sources expandable without re-running curriculum creation or swapping curriculum sources after the first lesson is already live.

## Scope

### homeschool-v2

- add a fast-path route collapse step after weekly-route generation in onboarding
- add route expansion actions that schedule queued future items from Today
- wire those actions into the lesson-side Today panel
- revalidate `Today` and `Planning` after expansion
- add product events for successful expansion and blocked/no-op expansion

### learning-core

- no required change in this phase
- Phase 6 uses the bounded launch depth already produced by `curriculum_generate`

## Scheduling Contract

### On fast-path onboarding

- generate bounded curriculum depth from the source as before
- generate the weekly route as before
- immediately collapse the route to a launch window:
  - today’s item stays scheduled
  - future items become queued
  - items that would have landed before today are removed from the launch route

### On expansion

- `tomorrow` schedules the next queued item on the next enabled planning day
- `next_few_days` schedules the next few queued items forward from tomorrow
- `current_week` schedules queued items across the remaining enabled days in the current week
- already scheduled future dates count as already expanded, not as failure
- if no queued future depth exists, return a bounded/no-op result instead of forcing fake week growth

## UX Contract

After the first lesson and activity are ready, the parent can:

- keep the route bounded to today
- explicitly expand the route forward when the source is strong enough
- see expansion succeed without losing the current day’s lesson/activity state

The Today panel should explain expansion plainly:

- it schedules more of the already-generated bounded route
- it does not replace the current lesson
- it can no-op when there is no additional route depth yet

## Exit Criteria

- fast-path onboarding lands with one teachable day, not an already-stretched week
- Today exposes explicit expansion actions for tomorrow / next few days / current week
- expansion schedules future queued route items without disturbing today’s current lesson and activity
- weak sources stay bounded instead of manufacturing extra schedule depth
- `Planning` reflects the scheduled future items after expansion
