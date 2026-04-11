# Phase 3: Authorization And Data Safety Plan

## Purpose

This document turns Phase 3 of the deployment path into an implementation-ready plan.

Phase 2 established authenticated Supabase SSR sessions plus membership-backed workspace resolution.
Phase 3 moves authorization enforcement into the database and storage layers so tenancy rules no longer depend only on app code.

This phase should be completed before:

- any hosted deployment intended for real users
- any production use of Supabase Data API or Storage APIs
- broader UX redesign work that could expand data access paths

## Why This Phase Matters

Supabase exposes the `public` schema through the Data API by default. Official guidance is explicit: any table in an exposed schema must have RLS enabled, and tables without RLS in `public` are considered critically unsafe because they may be reachable through the API.

That means the app is not deployment-safe until:

1. RLS is enabled on user-facing tables.
2. Policies enforce organization and learner tenancy.
3. Storage access follows the same authorization model.
4. Service-role access remains limited to trusted backend-only operations.

## Current State

Today the app has better request-level authorization than it did before Phase 2:

- authenticated adult users are resolved through Supabase SSR auth
- organization access is derived from `memberships`
- learner selection is workspace preference, not identity
- parent and learner routes are protected by app session checks

But database safety is still incomplete because:

- many `public` tables still need RLS and policy coverage
- storage access has not been aligned to organization and learner ownership yet
- tenancy is enforced primarily in app code rather than inside Postgres and Storage
- Supabase Security Advisor warnings are expected until this phase lands

## Target State

After Phase 3, authorization should work like this:

1. Supabase Auth identifies the signed-in adult user.
2. Database policies derive allowed organizations from `adult_users.auth_user_id` plus `memberships`.
3. Learner-scoped rows are accessible only when the learner belongs to an authorized organization.
4. Storage object access is limited to approved buckets and ownership paths.
5. Service-role access exists only for explicit backend-only operations.
6. Supabase Security Advisor no longer reports public user-facing tables with RLS disabled.

## Scope

### In Scope

- inventory of public tables and storage surfaces relevant to tenancy
- RLS enablement for user-facing tables
- policy functions/helpers for organization and learner authorization
- storage bucket and object policies
- table-level privilege review where it materially reduces exposure
- documentation updates in `docs/plans/path_to_deployment`

### Out Of Scope

- hosted staging and production setup
- deep admin tooling
- major data-model redesign
- broad UI redesign
- MFA, SSO, or advanced auth hardening beyond current session model

## Architecture Rules

- Identity comes from Supabase Auth JWTs.
- Adult-user authorization comes from `adult_users.auth_user_id` joined to `memberships`.
- Organization-level access must be enforceable without trusting the app server.
- Learner-level access must require that the learner belongs to an authorized organization.
- Policies should prefer simple, reusable authorization helpers instead of duplicating complex joins on every table.
- Storage policies must align with the same organization and learner model.
- Service-role usage must remain explicit, server-only, and auditable.

## Repo-Specific Authorization Model

The current schema naturally breaks into a few policy families.

### Family 1: Identity And Organization Access

Core tables:

- `adult_users`
- `organizations`
- `memberships`
- `organization_platform_settings`

These tables establish who the adult user is and which organizations they may access.

### Family 2: Learner Records

Core tables:

- `learners`
- `learner_profiles`
- `learning_goals`
- `goal_mappings`

These should be readable and writable only through an authorized organization path.

### Family 3: Curriculum And Routing

Core tables:

- `curriculum_sources`
- `curriculum_phases`
- `curriculum_phase_nodes`
- `curriculum_progression_state`
- `curriculum_assets`
- `curriculum_items`
- `curriculum_item_standards`
- `curriculum_nodes`
- `curriculum_skill_prerequisites`
- `learner_route_profiles`
- `learner_branch_activations`
- `learner_skill_states`
- `weekly_routes`
- `weekly_route_items`
- `route_override_events`
- `plan_item_curriculum_links`

These are mixed organization-, source-, and learner-scoped entities. Policies should anchor them through `organization_id`, `source_id`, or `learner_id`, not through free access.

### Family 4: Planning And Sessions

Core tables:

- `plans`
- `plan_weeks`
- `plan_days`
- `plan_items`
- `plan_item_standards`
- `lesson_sessions`

These should follow the same organization and learner boundaries as planning surfaces in the app.

### Family 5: Activities, Evidence, Workflow, Tracking

Core tables:

- `generated_artifacts`
- `interactive_activities`
- `activity_standards`
- `activity_attempts`
- `activity_evidence`
- `evidence_records`
- `evidence_record_objectives`
- `feedback_entries`
- `review_queue_items`
- `progress_records`
- `progress_record_standards`
- `observation_notes`

These tables carry the richest learner data and should be treated as the most sensitive user-facing family.

### Family 6: Copilot And Recommendations

Core tables:

- `conversation_threads`
- `conversation_messages`
- `copilot_actions`
- `adaptation_insights`
- `recommendations`

These are organization- and learner-sensitive. The Security Advisor warning on `public.recommendations` is part of this family.

### Family 7: Homeschool Reporting And Audit

Core tables:

- `homeschool_attendance_records`
- `homeschool_audit_events`

These should remain organization-scoped with learner-level constraints when learner-linked.

### Family 8: Standards And Shared Reference Data

Core tables:

- `standard_frameworks`
- `standard_nodes`

These may be partly global and partly organization-specific. Policies should distinguish:

- global reference rows where `organization_id is null`
- org-owned custom rows where `organization_id` must match an authorized organization

## Recommended Policy Strategy

### Step 1: Add Shared Authorization Helper Functions

Goal:
- avoid repeating the same membership join logic in every policy

Recommended helper functions:

- `public.current_auth_user_id()`
- `public.current_adult_user_id()`
- `public.is_member_of_organization(target_org_id text)`
- `public.can_access_learner(target_learner_id text)`

Guidance:

- keep these functions stable and simple
- prefer `select auth.uid()` and small lookup helpers
- if needed, use `security definer` carefully for lookup functions that should bypass nested policy overhead
- do not expose privileged helper functions carelessly in broad API surfaces

### Step 2: Enable RLS On Public User-Facing Tables

Goal:
- remove the “RLS disabled in public schema” class of warnings

Apply `alter table ... enable row level security` to all user-facing public tables in migration order.

Recommendation:
- do this in grouped migrations by domain family instead of one giant all-or-nothing migration
- begin with the tables Supabase is already flagging in Security Advisor

### Step 3: Add Organization And Learner Policies By Family

Goal:
- make policies reviewable and predictable

Pattern:

- organization-owned rows: allow access when `is_member_of_organization(organization_id)`
- learner-owned rows: allow access when `can_access_learner(learner_id)`
- child rows without direct org id: derive access through parent row joins or helper functions
- reference rows: allow access only when globally shared or org-owned

Recommendation:
- write `select`, `insert`, `update`, and `delete` policies explicitly
- specify `to authenticated` where appropriate
- avoid leaving broad `anon` access unless a surface is intentionally public

### Step 4: Review Table Grants Alongside RLS

Goal:
- reduce accidental exposure even before policy logic runs

Review whether `anon` and `authenticated` should retain broad CRUD grants on all public tables.

Recommendation:

- revoke unnecessary privileges from `anon` on most app tables
- keep any intentionally public reference access narrowly scoped
- use grants plus RLS together rather than treating RLS as the only control

### Step 5: Add Storage Policies

Goal:
- align Storage with the same tenancy model

Known repo storage surfaces include:

- curriculum asset files (`curriculum_assets.storage_bucket`, `curriculum_assets.storage_path`)
- evidence uploads (`evidence_records.storage_path`)
- generated artifacts and activity evidence with file-backed payloads

Recommendation:

- define bucket list and intended access model first
- use `storage.objects` policies for `select`, `insert`, `update`, `delete`
- restrict by `bucket_id` and path structure
- prefer predictable org/learner path conventions over ad hoc object names

### Step 6: Keep Service-Role Access Narrow

Goal:
- ensure RLS is real, not bypassed accidentally

Keep service-role access only for:

- trusted server-side maintenance
- explicit admin/auth operations
- storage operations that cannot yet be expressed safely through user-scoped policies

Any route that can run under authenticated user context should not depend on service role just because it is convenient.

### Step 7: Add Verification And Advisor Checks

Goal:
- make this phase testable and reviewable

Verification should include:

- signed-in household user can read and write only their org rows
- cross-org access attempts fail through direct Supabase API calls
- learner records fail when the learner belongs to another org
- storage uploads/downloads fail outside authorized bucket/path rules
- Supabase Security Advisor warnings drop as expected

## Recommended Implementation Order

### Step 1: Inventory And Classification

Deliverables:

- final table inventory with policy anchors
- list of storage buckets and expected path conventions
- list of tables that may remain server-only

### Step 2: Authorization Helper Migration

Deliverables:

- SQL helper functions for membership and learner access
- notes on whether helper functions are regular or `security definer`

### Step 3: Core Identity And Learner Family Policies

Prioritize:

- `adult_users`
- `organizations`
- `memberships`
- `organization_platform_settings`
- `learners`
- `learner_profiles`
- `learning_goals`

These create the base trust model for every other domain.

### Step 4: Planning, Curriculum, And Routing Policies

Prioritize the tables that power primary app workflows.

### Step 5: Activities, Evidence, Tracking, Workflow Policies

Prioritize the most sensitive learner data next.

### Step 6: Copilot, Recommendations, Homeschool, And Standards Policies

Use standards rules to separate global reference rows from org-owned rows.

### Step 7: Storage Policy Pass

Apply bucket and object policies once path conventions are confirmed.

### Step 8: Security Advisor And Direct API Verification

Close the loop by testing real failure paths and recording remaining gaps.

## Likely File Targets

Primary Phase 3 write areas will likely include:

- `lib/db/schema/**`
- `lib/db/repositories/**`
- new SQL migrations for RLS and helper functions
- `lib/storage/**`
- `docs/plans/path_to_deployment/**`

If new auth helper SQL is introduced, document it clearly because future phases will depend on it.

## Open Decisions To Lock Early

1. Should any app table remain intentionally accessible through the Data API without organization membership?
Recommendation: no for product data; only tightly-scoped shared reference data should remain broadly readable.

2. Should standards frameworks be global, organization-owned, or mixed?
Recommendation: mixed. Allow global reads for shared frameworks and organization-scoped access for custom frameworks.

3. Should storage object names encode organization and learner identifiers?
Recommendation: yes. Predictable path conventions make policies far simpler and safer.

4. Should `public` remain an exposed schema long term?
Recommendation: probably yes for near-term pragmatism, but Phase 4 or later can consider exposing a narrower custom schema if the app continues to grow.

## Local-First Development Plan

This phase should still begin locally.

Use:

- local Supabase stack
- SQL migrations committed in the repo
- local sign-in flows from Phase 2
- direct API checks against local Supabase clients

What must be true locally before Phase 3 is called done:

- user-facing public tables have RLS enabled
- core org and learner tenancy is enforced in Postgres
- storage operations obey policy rules
- Supabase Security Advisor warnings are materially reduced or resolved for user-facing tables

## Implementation Notes

Phase 3 implementation in this repo uses:

- a single SQL migration: `drizzle/0008_phase3_authorization_rls.sql`
- shared authorization helpers in a private schema
- explicit `authenticated` policies for app-facing tables plus storage buckets
- a direct verification script: `corepack pnpm verify:phase3:rls`

One legacy edge case exists in some older local databases: `public.curriculum_objectives` may still be present even though it is not created by the current clean migration chain. Phase 3 secures that table conditionally when it exists, without breaking fresh local rebuilds.

## References

- Supabase: Securing your API
  https://supabase.com/docs/guides/api/securing-your-api
- Supabase: Hardening the Data API
  https://supabase.com/docs/guides/api/hardening-data-api
- Supabase: Storage Access Control
  https://supabase.com/docs/guides/storage/security/access-control
- Supabase: Storage Ownership
  https://supabase.com/docs/guides/storage/security/ownership
