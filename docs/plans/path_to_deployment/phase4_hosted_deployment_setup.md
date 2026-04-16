# Phase 4: Hosted Deployment Setup Plan

## Purpose

This document turns Phase 4 of the deployment path into an implementation-ready hosted setup plan.

Phase 3 made the app safe to expose through hosted Supabase and Storage.
Phase 4 is where we create the real hosted environments, define the environment model, and make deployment predictable enough that later UX work can ship against a real staging stack instead of only local infrastructure.

## Deployment Target

For this repo, the practical hosted shape is:

- `homeschool-v2` on Vercel
- Supabase hosted projects for `staging` and `production`
- `learning-core` as a separate Python service on Google Cloud Run

That gives us:

- preview deployments for UI and route review on Vercel
- one stable staging app environment with its own Supabase project
- one stable production app environment with its own Supabase project
- a separate AI/runtime service boundary that matches the current repo contract

This is the default recommendation for implementation.
It reflects your preference to optimize for free-tier headroom over minimal setup friction.
It is still an inference from the current codebase plus the current provider docs, not a guarantee that no other provider would work.

## Why This Phase Matters

The repo can now enforce auth and tenancy correctly, but deployment is still not operationally safe until we define:

1. which hosted projects and services exist
2. which environment owns which secrets
3. how schema changes move from local to staging to production
4. how logs, backups, and rollback paths are accessed
5. how the app and `learning-core` talk to each other in each environment

Without this phase, the app is still easy to misconfigure even if the code is correct.

## Current Repo Reality

The current env surface in this repo is:

- `APP_ENV`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_PROJECT_REF`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `LEARNING_CORE_BASE_URL`
- `LEARNING_CORE_API_KEY`
- `INNGEST_BASE_URL`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

Important implementation constraint:

- local development still applies SQL migrations from `drizzle/*.sql` at runtime through `lib/db/migrations.ts`
- hosted app startup no longer reads `drizzle/` from the filesystem
- staging and production databases must be provisioned or migrated before the Vercel app boots
- the repo still treats `drizzle/*.sql` as the schema source of truth for that manual rollout

## Recommended Hosted Environment Model

### App Environments

Use one Vercel project for the Next.js app with:

- `Preview` for branch and PR deploys
- `Production` for the live app
- optional `staging` custom environment if your Vercel plan supports it

If you do not want to rely on Vercel custom environments, use this simpler fallback:

- Vercel `Preview` for branch deploys
- Vercel `Production` for the live app
- a separate long-lived `staging` branch preview URL for the staging app

### Database Environments

Use separate Supabase hosted projects:

- one `staging` project
- one `production` project

Do not share a hosted Supabase project between staging and production.

### AI Runtime Environments

Long-term target:

- one staging service
- one production service

Current implementation decision for this phase:

- use one shared hosted `learning-core` deployment across preview and production
- keep the service boundary and shared API key stable
- defer full staging/production service isolation until later if it becomes operationally necessary

Recommended eventual shape:

- one Cloud Run service per environment
- container-based deploys
- environment variables managed per service
- public HTTPS endpoint protected by an application-level API key
- request timeout and concurrency configured explicitly

Cloud Run is the default recommendation here because its current free tier is materially more generous than Render's free web-service offering, and you said you do not mind the extra setup. The practical deployment shape is still public HTTPS plus an application-level API key, since Vercel will call the service over the public internet.

## Environment Topology

### Local

Purpose:
- active development
- fast iteration
- local Supabase and local `learning-core`

### Preview

Purpose:
- branch review
- UI review
- non-critical route testing

Recommendation:
- point preview deploys at staging-grade external services only if the feature actually needs full backend integration
- otherwise keep preview deploys non-critical and avoid letting every branch write to production systems

### Staging

Purpose:
- realistic integration testing
- schema verification
- auth, storage, and service boundary testing
- final review before production

Staging should have:

- its own Supabase project
- its own `learning-core` service
- its own app URL
- its own secrets

### Production

Purpose:
- real users
- real data
- stable custom domain

Production should have:

- its own Supabase project
- its own `learning-core` service
- production-only secrets
- production log access and rollback notes

## Recommended Implementation Order

### Step 1: Create Hosted Supabase Projects

Create:

- `homeschool-v2-staging`
- `homeschool-v2-production`

For each hosted project, record:

- project ref
- project URL
- publishable key
- service role key
- database connection string
- Studio URL

Immediately after project creation:

- confirm auth is enabled
- confirm storage is available
- confirm backups are enabled according to the selected plan
- record who has admin access to the project

### Step 2: Create Hosted `learning-core` Services

Long-term target:

- `learning-core-staging`
- `learning-core-production`

Current Phase 4 fallback:

- one shared hosted `learning-core` deployment is acceptable
- record the shared service URL and API key
- point both preview and production app environments at that shared service for now

For each eventual service, record:

- service URL
- health check path
- deploy branch
- build command
- start command
- required secrets

Initial rule:

- staging app talks only to staging `learning-core`
- production app talks only to production `learning-core`

### Step 3: Create Or Configure The Vercel Project

Create one Vercel project for `homeschool-v2`.

Set up:

- framework detection for Next.js
- production branch
- preview deployment behavior
- team/project access
- environment variables by environment

Decide whether staging is handled as:

- a Vercel custom environment, or
- a stable preview deployment on a staging branch

Document that choice before implementation begins.

### Step 4: Define The Environment Variable Matrix

Before entering secrets anywhere, create the full matrix for:

- local
- preview
- staging
- production

That matrix should answer:

- which values are required everywhere
- which values differ by environment
- which values must never be reused across staging and production
- which values are safe to expose publicly (`NEXT_PUBLIC_*`)

Use [phase4_env_matrix.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/phase4_env_matrix.md) as the source of truth.

### Step 5: Define Hosted Migration Flow

Because hosted app startup no longer runs SQL migrations from `drizzle/*.sql`, Phase 4 needs an explicit predeploy migration rule.

Recommended near-term rule:

1. apply committed SQL migrations to the staging database before or during the staging rollout
2. deploy the exact same app build to staging after the schema is ready
3. verify app health, auth, and `public._hsv2_schema_migrations`
4. promote the same schema state and app code to production only after staging passes
5. keep SQL migrations small and additive where possible

This is workable, but it is not the long-term ideal. A later hardening phase should likely add a first-class migration command or CI step instead of relying on manual SQL application.

### Step 6: Define Backup And Rollback Expectations

For Supabase:

- document whether the selected hosted plan includes physical backups
- document whether PITR is available
- document how to restore to a new project for investigation or recovery

For Vercel:

- document how to roll back to a previous deployment
- document who has production deploy permission

For `learning-core`:

- document how to redeploy the previous stable version
- document how API key rotation is handled

### Step 7: Define Monitoring And Logs

At minimum, record where to inspect:

- Vercel runtime logs for the app
- Supabase project logs and Studio
- Cloud Run revision/runtime logs for `learning-core`
- health endpoints for app and core

If alerts are not configured in Phase 4, document that explicitly as a deferral instead of leaving it implicit.

## Recommended Decisions For This Repo

### Decision 1: One Vercel Project Or Two

Recommendation:
- one Vercel project for the app

Reason:
- simpler domain and settings management
- cleaner preview flow
- easier to keep one app identity

### Decision 2: Staging As Custom Environment Or Separate Project

Recommendation:
- prefer one Vercel project plus a custom `staging` environment if your plan supports it
- fallback to a stable staging branch preview if you do not want extra project complexity

### Decision 3: Separate Supabase Projects

Recommendation:
- always separate `staging` and `production` Supabase projects

Reason:
- avoids accidental production writes during staging verification
- keeps auth users, storage, and data boundaries clean

### Decision 4: `learning-core` Hosting

Recommendation:
- use Google Cloud Run as the default first hosted target for `learning-core`

Reason:
- materially stronger free-tier economics than Render's free web service
- straightforward public HTTPS service model once the container is built
- explicit control over concurrency, request timeout, and revision rollout

Fallback:
- Render remains the simpler operational fallback if Cloud Run setup becomes a distraction, but it is no longer the default recommendation.

This is a recommendation based on the current repo shape, your stated preference, and the current provider docs, not a hard requirement.

### Decision 5: Inngest In Phase 4

Current repo reality:
- env vars exist for Inngest
- I did not find an app route under `app/api/inngest`

Recommendation:
- do not block hosted setup on Inngest
- either provide placeholder hosted values temporarily so the env schema passes, or remove the runtime requirement in a later cleanup
- do not present Inngest as launch-critical until there is a real hosted path in the app

## Deliverables For Phase 4

At the end of Phase 4, we should have:

- hosted Supabase staging and production projects
- a working hosted `learning-core` integration, even if it remains a single shared deployment for now
- Vercel project configured with preview and production deploys
- final env matrix checked into docs
- documented local-to-staging-to-production migration flow
- backup and rollback notes
- monitoring and log access notes

## Exit Criteria

Phase 4 is done when all of the following are true:

- staging app deploys successfully
- staging app can sign in against staged Supabase auth
- staging app can read and write staged storage correctly
- staging app can talk to staging `learning-core`
- production env vars are defined but not yet misused in staging
- rollback paths are documented
- the deployment tracker and checklist are current

## References

These recommendations were checked against current provider docs:

- Vercel environment variables: https://vercel.com/docs/environment-variables
- Supabase managing environments: https://supabase.com/docs/guides/deployment/managing-environments
- Supabase backups: https://supabase.com/docs/guides/platform/backups
- Supabase restore to new project: https://supabase.com/docs/guides/platform/clone-project
- Google Cloud Run pricing: https://cloud.google.com/run/pricing
- Google Cloud Run free tier: https://cloud.google.com/free/docs/free-cloud-features
- Google Cloud Run container configuration: https://cloud.google.com/run/docs/configuring/services/containers
- Google Cloud Run request timeout: https://cloud.google.com/run/docs/configuring/request-timeout
- Render web services fallback: https://render.com/docs/web-services
