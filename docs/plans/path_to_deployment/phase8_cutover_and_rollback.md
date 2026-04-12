# Phase 8: Cutover And Rollback Runbook

Use this runbook during launch prep and on launch day.

The goal is to make the first production deploy, first smoke check, and first rollback path obvious.

## Release Path

Current branch policy:
- `stage` is the staging integration branch
- `main` is the production branch

Current deploy shape:
- pushing `stage` updates the stable preview/staging deployment path
- pushing `main` updates the production deployment path

## Pre-Deploy Checks

Before shipping to production:

1. confirm `main` contains only the intended release changes
2. run:

```bash
bash ./scripts/verify-before-merge.sh
```

3. confirm the latest Phase 8 QA notes are current
4. confirm deferred items are documented and accepted
5. confirm the current env split is still correct:
   - preview -> staging Supabase
   - production -> production Supabase

## Production Deploy

Release sequence:

1. merge the approved release changes into `main`
2. push `main`
3. wait for the production Vercel deployment to finish
4. run the immediate smoke checks

## Immediate Post-Deploy Smoke Checks

Minimum routes:

- `/`
- `/auth/login`
- `/today`
- `/learner`
- one live `/activity/[sessionId]` if available
- `/curriculum`
- `/planning`
- `/tracking`
- `/copilot`
- `/account`

Minimum behaviors:

- signed-out entry loads
- sign-in works
- `Today` loads
- learner handoff is visible from `Today`
- learner queue loads
- one learner activity opens
- Copilot loads without runtime failure

## Vercel Logs

Use Vercel runtime logs first for app issues.

Check:
- latest deployment status
- runtime errors on the routes above
- failures during auth redirects, data loading, or Copilot/activity requests

## Cloud Run Logs

Use Cloud Run logs when the app loads but AI-backed flows fail.

Primary cases:
- Copilot request failures
- lesson/activity generation failures
- prompt-preview or execution failures that originate in `learning-core`

If the app shell is healthy but AI flows fail:
- check the `learning-core` service logs and revision health next

## Supabase Checks

Use Supabase for:
- auth issues
- missing session resolution
- data inconsistencies
- storage issues

Check:
- Auth users and sign-in events
- database rows for the affected household/learner
- Storage objects if uploads/evidence are involved
- Security or policy regressions if access suddenly fails

## First Response By Failure Type

### 1. App Route Fails To Load

Check in order:
1. Vercel deployment status
2. Vercel runtime logs
3. whether the failure is route-specific or global
4. whether the issue is environment/config related

### 2. Auth Or Setup Flow Fails

Check in order:
1. Vercel runtime logs
2. Supabase Auth
3. app-session resolution behavior
4. whether env vars point to the right Supabase project

### 3. Learner Or Parent Data Looks Wrong

Check in order:
1. current active learner/workspace state
2. DB records for the org and learner
3. whether the issue is stale data vs a route bug

### 4. AI-Assisted Flow Fails

Check in order:
1. Vercel runtime logs on the app route/API call
2. `learning-core` logs
3. environment vars for `LEARNING_CORE_BASE_URL` and `LEARNING_CORE_API_KEY`

## Rollback Path

If production is unhealthy after release:

1. identify whether the issue is:
   - app deploy only
   - AI service issue
   - auth/data issue

2. for app-only issues:
   - roll back the Vercel deployment to the last good production revision
   - or revert the release commit on `main` and redeploy

3. for AI service issues:
   - roll back the Cloud Run service to the last good revision if needed
   - keep app rollback separate from AI rollback

4. for Supabase/data/auth issues:
   - do not try random app rollbacks first
   - inspect auth/config/data state directly
   - use backups or project recovery paths only if the issue is truly data/platform level

## Owner Prompts To Fill Before Launch

Record these before launch day:

- deploy owner
- QA owner
- rollback owner
- first-response owner for app/runtime issues
- first-response owner for `learning-core`
- first-response owner for Supabase/auth/storage

