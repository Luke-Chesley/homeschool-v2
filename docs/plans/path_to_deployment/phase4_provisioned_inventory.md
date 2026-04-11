# Phase 4: Provisioned Resource Inventory

This file records the actual hosted resources provisioned during the current Phase 4 pass.

It is intentionally operational and concrete.
Use it with the broader plan and checklist docs.

## Current Status

As of 2026-04-11:

- hosted Supabase staging project exists
- hosted Supabase production project exists
- both hosted Supabase projects have the repo schema applied
- both hosted Supabase projects have clean security advisor output after the helper-function fix
- Vercel project exists and is linked locally
- Vercel has no deployments yet
- Cloud Run has not been provisioned from this session

## Supabase Projects

### Staging

- name: `homeschool-v2-staging`
- project id/ref: `ntlcjsnstxytxnfagyly`
- region: `us-west-1`
- project URL: `https://ntlcjsnstxytxnfagyly.supabase.co`
- database host: `db.ntlcjsnstxytxnfagyly.supabase.co`
- status: `ACTIVE_HEALTHY`
- schema bootstrap: complete
- security advisor: clean after helper-function patch

### Production

- name: `homeschool-v2-production`
- project id/ref: `rqgiopliqeatdbgnbtnh`
- region: `us-west-1`
- project URL: `https://rqgiopliqeatdbgnbtnh.supabase.co`
- database host: `db.rqgiopliqeatdbgnbtnh.supabase.co`
- status: `ACTIVE_HEALTHY`
- schema bootstrap: complete
- security advisor: clean after helper-function patch

## Vercel

- team name: `lukechesleyfive-2290's projects`
- team slug: `lukechesleyfive-2290s-projects`
- team id: `team_fMdS6eQ8mA0e2KgjNWZSco7q`
- project name: `homeschool-v2`
- project id: `prj_C9V6Mgxl4XhZiOAcsHEZhI7eY7YC`
- framework: `nextjs`
- local link file: `.vercel/project.json`
- latest deployment: none yet
- custom domains: none yet

## Hosted Schema Bootstrap

The hosted Supabase projects were bootstrapped from the repo's current SQL source of truth:

- `drizzle/0000_initial.sql`
- `drizzle/0001_platform_expansion_foundation.sql`
- `drizzle/0002_flexible_skill_scheduling.sql`
- `drizzle/0002_remove_legacy_ai_platform_tables.sql`
- `drizzle/0003_structured_activity_runtime.sql`
- `drizzle/0004_lesson_draft_ownership.sql`
- `drizzle/0005_curriculum_progression_graph.sql`
- `drizzle/0006_progression_state.sql`
- `drizzle/0007_homeschool_wedge_records.sql`
- `drizzle/0008_phase3_authorization_rls.sql`

The bootstrap also created and populated `public._hsv2_schema_migrations` in both hosted projects.

## Remaining Blockers

These items still require manual setup or external tooling not available through the current MCP surface.

### 1. Hosted Supabase Secret Retrieval

Still needed for Vercel env configuration:

- staging `SUPABASE_SERVICE_ROLE_KEY`
- production `SUPABASE_SERVICE_ROLE_KEY`
- staging `DATABASE_URL`
- production `DATABASE_URL`

The current Supabase MCP tools exposed project refs, URLs, project hosts, and publishable keys, but not the hosted service role keys or full database connection strings.

### 2. Cloud Run Provisioning

Still needed:

- Google Cloud project selection
- Cloud Run service creation for staging and production `learning-core`
- container build/deploy path for `learning-core`
- Cloud Run service URLs
- Cloud Run env vars and API key setup

This session does not have Google Cloud provisioning tools.

### 3. Vercel Environment Variables

Still needed before the first meaningful deployment:

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

The Vercel project exists, but this session did not have a reliable env-management tool path for setting all hosted secrets end to end.

## Immediate Next Actions

1. Retrieve the hosted Supabase service role keys and database connection strings from Supabase dashboard for both projects.
2. Provision `learning-core` on Cloud Run for staging and production.
3. Set the full Vercel env matrix.
4. Run the first staging deployment.
5. Verify staged auth, storage, and `learning-core` connectivity.
