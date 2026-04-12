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
- Vercel preview and production deployments have both been exercised during Phase 4
- `stage` is the stable staging preview branch and `main` is the production branch
- preview and production Supabase wiring are split by Vercel environment
- `learning-core` is currently treated as one shared hosted service across preview and production

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
- stable staging alias: `homeschool-v2-git-stage-lukechesleyfive-2290s-projects.vercel.app`
- production aliases include: `homeschool-v2.vercel.app`, `homeschool-v2-git-main-lukechesleyfive-2290s-projects.vercel.app`
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

## Remaining Deferrals

These items do not block Phase 4 completion, but they should be closed before launch.

### 1. Hosted Storage Verification

Still needed:

- one explicit end-to-end storage or evidence-upload check against hosted staging

### 2. Rollback And Recovery Notes

Still needed:

- app rollback notes for Vercel production
- `learning-core` rollback notes for the shared hosted service
- Supabase staging and production recovery notes

### 3. Future Service Isolation

Possible later hardening:

- split the shared `learning-core` deployment into separate staging and production services if operational isolation becomes necessary
