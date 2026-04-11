# Phase 2: Auth And Workspace Hardening Plan

## Purpose

This document turns Phase 2 of the deployment path into an implementation-ready plan.

Phase 1 created the `studio mode` foundation.
Phase 2 replaces the current cookie-only workspace identity model with real authenticated user resolution while preserving the existing organization and learner flows.

This phase should be completed before:

- RLS and storage policy work
- hosted staging/production rollout
- major UX redesign work that depends on stable session semantics

## Current State

The current app session is derived from cookies in [lib/app-session/server.ts](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/../../../../lib/app-session/server.ts).

Today it works like this:

- `hsv2_org_id` selects the active organization
- `hsv2_learner_id` selects the active learner
- `getWorkspaceContext()` falls back to the first valid organization and learner
- parent and learner routes trust that workspace resolution

That is acceptable for local iteration, but it is not sufficient for deployment because:

- cookies currently act as identity, not just workspace preference
- there is no enforced sign-in boundary for parent or learner routes
- organization access is not yet derived from authenticated membership
- learner selection is mixed into session identity instead of remaining scoped workspace state

## Target State

After Phase 2, session behavior should work like this:

1. A request resolves the authenticated Supabase user from SSR auth cookies.
2. The app maps that auth user to `adult_users.auth_user_id`.
3. The app resolves one or more valid `memberships` for that adult user.
4. The app chooses an active organization from membership-backed options.
5. Learner choice remains a workspace preference inside the active organization.
6. Parent and learner routes require authenticated membership-backed access.
7. Cookie values remain useful only for workspace preference, never as the sole source of identity.

## Scope

### In Scope

- Supabase SSR auth for the App Router
- auth route wiring for sign-in, sign-up, sign-out, confirm, and session refresh/callback
- membership-backed organization resolution
- learner selection as workspace state
- parent and learner route protection
- reducing unnecessary service-role usage where end-user requests can run as user-scoped operations
- documentation updates in `docs/plans/path_to_deployment`

### Out Of Scope

- RLS policies
- storage policies
- hosted Supabase/Vercel setup
- full onboarding redesign
- new org admin tools
- native mobile work

## Architecture Rules

- Identity comes from Supabase auth, not from app cookies.
- Organization access comes from `memberships`, not from guessed defaults.
- Learner selection is a preference scoped to an already-authorized organization.
- Parent routes must require an authenticated adult user.
- Learner routes may still render a learner-focused shell, but access must still originate from an authenticated adult user in Phase 2.
- `service_role` must stay limited to trusted backend operations that truly require it.
- The app must still be able to run this phase locally before hosted deployment work begins.

## Existing Building Blocks

The repo already has several pieces we should reuse instead of rewriting:

- [lib/platform/supabase.ts](/home/luke/Desktop/homeschool-v2/lib/platform/supabase.ts)
- [lib/auth/server.ts](/home/luke/Desktop/homeschool-v2/lib/auth/server.ts)
- [lib/db/schema/organizations.ts](/home/luke/Desktop/homeschool-v2/lib/db/schema/organizations.ts)
- [lib/db/repositories/organizations.ts](/home/luke/Desktop/homeschool-v2/lib/db/repositories/organizations.ts)
- [lib/users/service.ts](/home/luke/Desktop/homeschool-v2/lib/users/service.ts)
- [lib/app-session/server.ts](/home/luke/Desktop/homeschool-v2/lib/app-session/server.ts)

Important data model facts already present:

- `adult_users.auth_user_id` exists as the auth bridge
- `memberships` already model org access
- learners are already scoped by `organization_id`

That means Phase 2 is a migration of session resolution, not a new auth architecture.

## Recommended Implementation Order

### Step 1: Add SSR Supabase Auth Plumbing

Goal:
- resolve the current authenticated Supabase user in App Router requests

Add:
- a request-safe SSR auth helper for server components, route handlers, and server actions
- a small auth session accessor that reads Supabase auth from request cookies rather than raw access-token arguments

Likely touch points:
- `lib/platform/supabase.ts`
- `lib/auth/server.ts`
- new helper such as `lib/auth/session.ts`

Deliverables:
- `getRequestAuthSession()`
- `requireAuthenticatedUser()`
- stable typed result for `user`, `session`, and auth error state

### Step 2: Add Membership-Backed Adult User Resolution

Goal:
- map Supabase auth users to internal adult users and memberships

Add:
- repository/helper to resolve `adult_users` by `auth_user_id`
- repository/helper to list valid memberships for the adult user
- one canonical resolver for “active adult user + allowed organizations”

Likely touch points:
- `lib/db/repositories/organizations.ts`
- new file such as `lib/auth/identity.ts`
- possibly `lib/users/service.ts`

Deliverables:
- `getAdultUserForAuthUser(authUserId)`
- `listMembershipsForAdultUser(adultUserId)`
- `resolveAuthorizedOrganizations(authUserId)`

### Step 3: Redesign App Session Around Auth + Workspace

Goal:
- keep the existing `AppWorkspace` shape where possible, but change how it is resolved

Refactor:
- `getAppSession()` should first require or inspect authenticated user state
- organization cookie becomes a preference among authorized organizations
- learner cookie becomes a preference among learners inside the active organization
- invalid cookies should be ignored and replaced by a valid membership-backed default

Likely touch points:
- `lib/app-session/server.ts`
- `lib/users/service.ts`

Target behavior:
- signed-out request gets `null` or redirect-safe unauthenticated result
- signed-in request gets a membership-scoped workspace
- active learner is chosen only after org authorization succeeds

Deliverables:
- explicit unauthenticated state
- explicit unauthorized-org fallback behavior
- explicit invalid-learner fallback behavior

### Step 4: Add Real Auth Routes And Screens

Goal:
- make sign-in and sign-out real app capabilities

Add or revise:
- sign-in route/page
- sign-up route/page
- auth callback/confirm route
- sign-out action/route

Use a minimal implementation first:
- calm, functional screens
- no major visual redesign yet
- enough to unblock protected-route development

Likely touch points:
- `app/`
- `components/ui/`
- `lib/auth/browser.ts`

Deliverables:
- user can sign in
- user can sign out
- confirm/callback flow lands in a valid app route

### Step 5: Protect Parent And Learner Routes

Goal:
- remove anonymous access to product routes

Apply:
- parent routes require authenticated adult user
- learner routes also require authenticated adult user plus valid active learner
- root route should route based on auth state and workspace availability

Likely touch points:
- `app/page.tsx`
- `app/(parent)/layout.tsx`
- `app/(learner)/layout.tsx`
- onboarding/users entry routes

Rules:
- signed out -> auth entry
- signed in with no membership -> controlled onboarding/recovery path
- signed in with membership but no learner -> learner setup/users path

### Step 6: Split Identity From Workspace Selection APIs

Goal:
- preserve the existing org/learner switching UX without letting it define identity

Refactor:
- `/api/app-session`
- user/learner selection endpoints
- any client code that assumes cookie changes alone are sufficient

Expected result:
- switching org or learner updates workspace preference only
- server always revalidates against authenticated membership

Likely touch points:
- `app/api/app-session/route.ts`
- `app/api/users/route.ts`
- `components/users/user-manager.tsx`

### Step 7: Review Service-Role Usage

Goal:
- identify requests that can run under authenticated user context instead of service role

Inventory at minimum:
- auth admin helpers
- storage client usage
- AI route usage that currently assumes broad backend trust

Likely touch points:
- `lib/auth/admin.ts`
- `lib/storage/client.ts`
- route handlers under `app/api/**`

Output:
- short table in this folder showing:
  - where `service_role` is still used
  - why it is needed
  - what can wait until Phase 3/RLS

### Step 8: Add Verification Gates

Goal:
- make Phase 2 testable before Phase 3 starts

Required checks:
- signed-out user cannot load parent routes
- signed-out user cannot load learner routes
- signed-in user resolves only organizations from membership
- invalid org cookie falls back to authorized org
- invalid learner cookie falls back to valid learner in org
- sign-out clears app access
- studio mode still works for local dev after auth changes

## Likely File Targets

Primary Phase 2 write areas:

- `lib/app-session/server.ts`
- `lib/auth/server.ts`
- `lib/auth/browser.ts`
- `lib/platform/supabase.ts`
- `lib/users/service.ts`
- `lib/db/repositories/organizations.ts`
- `app/page.tsx`
- `app/(parent)/layout.tsx`
- `app/(learner)/layout.tsx`
- `app/api/app-session/route.ts`
- `app/api/users/route.ts`
- new auth routes/pages under `app/`
- `docs/plans/path_to_deployment/**`

## Suggested Execution Slices

Do Phase 2 in these slices, in order:

1. SSR auth helper slice
2. adult user + membership resolver slice
3. `getAppSession()` refactor slice
4. auth screens and callback slice
5. route protection slice
6. org/learner selection API cleanup slice
7. service-role review slice
8. Phase 2 verification and documentation slice

This keeps the work reviewable and reduces the chance of breaking every route at once.

## Local-First Development Plan

This phase should still begin locally.

Use:
- local app server
- current local DB / local Supabase setup
- seeded `adult_users`, `memberships`, and learners

Do not wait for hosted staging to begin this phase.
Hosted environment work belongs to Phase 4.

What must be true locally before Phase 2 is called done:

- a local authenticated user can sign in
- that user maps to an `adult_users` record
- membership-backed organization resolution works
- parent and learner routes enforce auth locally

## Open Decisions To Lock Early

These should be decided at the start of implementation, not halfway through:

1. Should one adult user ever belong to multiple organizations in v1?
   Recommendation: yes in the data model, even if the first UX assumes one primary household.

2. Should learner routes remain adult-authenticated in v1?
   Recommendation: yes. Keep learner routes under adult-authenticated session semantics for now.

3. What is the fallback when a signed-in adult has no `adult_users` row yet?
   Recommendation: controlled onboarding bridge, not silent auto-creation in arbitrary routes.

4. Should app cookies remain at all?
   Recommendation: yes, but only for workspace preference.

## Acceptance Criteria

Phase 2 is complete when all of the following are true:

- Supabase SSR auth is the source of authenticated identity
- `adult_users.auth_user_id` is the bridge from auth user to product user
- active organization is resolved from valid membership
- active learner is resolved inside the active organization only
- parent and learner routes reject unauthenticated access
- workspace cookies are no longer treated as identity
- local verification steps are written and passing
- the deployment tracker is updated to reflect Phase 2 progress

## Recommended Next Doc After This One

Once implementation begins, create a second doc in this folder for execution tracking, for example:

- `phase2_auth_workspace_checklist.md`

That doc should list concrete tasks and mark progress as the implementation moves.
