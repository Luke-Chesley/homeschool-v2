# Deployment, Studio Mode, and UX Redesign Roadmap

## Why This Plan Exists

This document is the operating checklist for taking `homeschool-v2` from an internal, debug-heavy prototype to a deployable product with:

- production-safe auth and data isolation
- a first-class `studio mode` for you and future operators
- a calm, premium product UI for parents and learners
- responsive web support now, with a clean path to a later native mobile app

This is a cross-cutting roadmap. It does not replace the original `01` through `08` implementation packets. It sits above them and sequences the next major productization pass.

## Current Reality

The app already has strong foundations:

- Next.js App Router product app
- Supabase + Postgres + Drizzle base
- organization and learner-oriented schema
- external `learning-core` service boundary
- working parent and learner surfaces

The main blockers are not "missing app architecture". They are:

- auth/session hardening
- authorization and RLS
- hosted deployment setup
- removal of debug-heavy UI from default product flows
- a more disciplined product shell and reading-surface UX

## Product Principles For This Pass

- Keep one product app, not a rewrite into a new repo.
- Keep `learning-core` as a separate deployed service.
- Keep debug visibility, but move it into `studio mode`.
- Ship responsive web first.
- Make learner mobile web strong from day one.
- Delay native mobile until the web product and contracts are stable.

## Top-Level Milestones

1. Define launch scope and studio architecture
2. Implement production auth and workspace resolution
3. Add authorization, RLS, and storage policies
4. Stand up hosted environments and deployment flow
5. Ship studio mode infrastructure
6. Redesign the parent shell and Today workspace
7. Redesign learner lesson/activity reading flows
8. Redesign copilot, curriculum, planning, and tracking
9. Run staging hardening, QA, and launch prep

## Recommended Order

The right order is:

1. Studio architecture and auth/RLS decisions
2. Deployment foundation
3. Studio mode implementation
4. UX redesign on top of the new product/studio split

Do not postpone the UX redesign until every platform item is perfect. But do not start a major redesign before the studio split exists, because otherwise debug concerns will keep leaking back into the product UI.

## Phase 0: Scope Lock and Decision Pass

### Goal

Freeze the v1 launch shape and avoid accidental platform sprawl.

### Decisions To Make

- Launch surfaces:
  - `Today`
  - `Planning`
  - `Curriculum`
  - `Tracking`
  - `Copilot`
  - learner activity session
- Supported org model for v1:
  - start with one authenticated household account model
- Mobile scope:
  - responsive web for all surfaces
  - phone/tablet-first polish for learner activity
  - no native app in v1
- Async jobs:
  - either fully wire Inngest or remove it from launch-critical flows
- Debug policy:
  - keep all existing prompt/trace/runtime visibility
  - make it visible only in `studio mode`

### Deliverables

- written launch scope
- written studio mode rules
- written deployment topology
- written definition of what is explicitly out of v1

### Exit Criteria

- no unresolved debate about whether this is a web app, mobile app, or rewrite
- no unresolved debate about whether debug tooling stays in product UI

## Phase 1: Studio Mode Architecture

### Goal

Separate operator tooling from the default product experience without losing observability.

### Studio Mode Definition

`product mode`
- default for all normal users
- quiet shell
- no prompt dumps
- no lineage payloads
- no raw artifact envelopes
- no operator actions mixed into the main reading flow

`studio mode`
- available only for local dev or approved admin/operator users
- can expose prompt preview, request envelope, lineage, trace IDs, raw artifacts, transition events, and internal controls
- must be layered into the same routes instead of creating a completely separate app

### Architecture Rules

- Debug UI must be additive, not structural.
- A page must still work when all studio panels are disabled.
- Studio mode should prefer drawers, sheets, detail panels, expandable inspectors, and overlays.
- Debug state should be URL-addressable where useful.
- Heavy debug output should be collapsed by default.
- Studio visibility must be controllable by server-side authorization, not just a client flag.

### Concrete Implementation Plan

1. Define a studio access model.
   - local dev always allowed
   - production allowed only for approved adult users
   - store this in DB-backed org/user settings, not only env vars

2. Create a server-side studio resolver.
   - `isStudioEnabledForRequest`
   - `isStudioUser`
   - `canViewPromptPreviews`
   - `canViewRawArtifacts`

3. Add a stable studio context.
   - route-level server helpers
   - lightweight client context for UI toggles
   - URL param support for opening a specific studio panel

4. Add core studio primitives.
   - `StudioToggle`
   - `StudioDrawer`
   - `StudioPanel`
   - `StudioTraceLink`
   - `StudioJsonInspector`
   - `StudioEventTimeline`

5. Move current inline debug UI behind those primitives.
   - lesson-plan prompt preview
   - learning-core prompt preview cards
   - activity transition diagnostics
   - any raw draft/debug output in parent surfaces

6. Add traceability to the data layer.
   - store request IDs, operation names, artifact IDs, and timestamps
   - make it possible to jump from a screen to the underlying generation/debug record

### First Surfaces To Convert

- lesson draft generation
- curriculum AI draft flow
- copilot chat
- learner activity transition/feedback runtime

### Exit Criteria

- you can open debug info instantly when needed
- product mode pages no longer look like developer tooling
- there is one obvious pattern for adding future debug panels

## Phase 2: Auth and Workspace Hardening

### Goal

Replace cookie-only workspace identity with real authenticated user resolution.

### Why This Is Required

The current app session depends on org and learner cookies in `lib/app-session/server.ts`. That is not enough for a production multi-user app.

### Tasks

1. Move to Supabase SSR auth for App Router.
2. Add auth routes for sign-in, sign-up, sign-out, confirm, and session refresh.
3. Resolve the current adult user from Supabase auth user ID.
4. Resolve default organization and membership from the database.
5. Treat learner selection as workspace state after auth, not as identity itself.
6. Protect parent and learner routes with real server auth checks.
7. Review all service-role usage and minimize it.

### Data Model Notes

- `adult_users.authUserId` becomes the identity bridge
- memberships become the authorization basis
- learner selection remains a scoped workspace preference

### Exit Criteria

- a signed-out user cannot access parent or learner routes
- a signed-in user only sees orgs they belong to
- workspace cookies no longer act as the only identity source

## Phase 3: Authorization, RLS, and Storage Policies

### Goal

Protect real family and learner data at the database and storage layers.

### Tasks

1. Inventory all org-scoped and learner-scoped tables.
2. Add RLS for each user-facing table.
3. Add helper SQL functions or claims mapping if needed to connect auth users to adult users and memberships.
4. Add storage bucket policies for uploads and evidence assets.
5. Ensure server-side trusted operations are clearly separated from user-scoped operations.
6. Add advisor/security checks to the deployment checklist.

### Important Rule

Do not rely on app code alone for tenancy protection.

### Exit Criteria

- RLS is enabled where user data lives
- policy behavior is documented and testable
- storage access follows the same tenancy model as DB access

## Phase 4: Hosted Deployment Foundation

### Goal

Create a real staging and production path.

### Recommended Topology

- `homeschool-v2`: Vercel
- Postgres/Auth/Storage: hosted Supabase
- `learning-core`: separate Python service host

### Tasks

1. Create hosted Supabase projects:
   - staging
   - production

2. Create Vercel project and environments:
   - preview
   - production

3. Define environment variable matrix:
   - `NEXT_PUBLIC_SITE_URL`
   - Supabase URL/key set
   - service role key
   - database URL
   - `LEARNING_CORE_BASE_URL`
   - `LEARNING_CORE_API_KEY`

4. Decide migration flow:
   - how local `drizzle/` migrations get applied to staging and prod
   - who approves destructive schema changes

5. Add monitoring and logs:
   - Vercel runtime/build logs
   - Supabase advisors and DB visibility
   - app-level request IDs for AI and activity flows

6. Define backup and rollback expectations.

### Exit Criteria

- preview deploys are repeatable
- staging can run against hosted services
- production env setup is documented and reproducible

## Phase 5: Parent Shell Redesign

### Goal

Replace the current multi-layer shell with a restrained, premium product chrome.

### Problems To Fix

- too many persistent nav layers
- shell feels operational/debug-first
- parent UI uses too much card/chrome for routine navigation

### Target

- thin sticky top nav
- fewer persistent controls
- stronger typography
- more whitespace and calmer hierarchy
- no duplicate global tabs plus heavy sidebar plus dense top controls

### Tasks

1. Simplify global navigation model.
2. Decide where learner switcher lives.
3. Decide where studio toggle lives.
4. Redesign shell tokens only where necessary, preserving the calm serif/sans direction.
5. Ensure shell works cleanly on laptop and mobile widths.

### Exit Criteria

- navigation is calm and obvious
- shell supports both product and studio mode cleanly
- the app no longer reads like an internal tool

## Phase 6: Today Workspace Redesign

### Goal

Make `Today` the strongest product surface in the app.

### Direction

- center the day around a guided reading/doing flow
- remove debug clutter from the primary column
- keep actions local to the content they affect
- collapse secondary metadata and setup detail

### Tasks

1. Redesign route item list and lesson progression.
2. Move lesson draft debug into studio panels.
3. Build a dedicated lesson reading surface.
4. Keep execution controls obvious but quiet.
5. Recheck behavior for carry-forward, partial completion, skip, and repeat flows.

### Exit Criteria

- `Today` feels like the main product, not a planning debug screen
- lesson generation and execution feel integrated and calm

## Phase 7: Learner Activity Redesign

### Goal

Make learner sessions feel like rich, readable lesson flows rather than stacked widgets.

### Direction

- narrower reading column
- stronger typographic rhythm
- clearer sectioning
- inline interactions
- collapsed secondary details
- touch-friendly controls

### Tasks

1. Redesign learner page shell.
2. Rework `ActivitySpecRenderer` into a reading-flow composition.
3. Keep progress visible but understated.
4. Make response capture and feedback feel inline.
5. Ensure mobile and tablet usability.
6. Move runtime diagnostics to studio mode.

### Exit Criteria

- learner activities feel calm and modern on tablet and phone
- the experience works well without desktop assumptions

## Phase 8: Copilot, Curriculum, Planning, and Tracking Refresh

### Goal

Bring the rest of the product up to the same shell and reading-surface standard.

### Focus Order

1. Copilot
2. Curriculum
3. Planning
4. Tracking

### Notes

- Copilot should stay chat-first and quiet.
- Curriculum should favor readable source flow over management clutter.
- Planning should support scheduling without dashboard overload.
- Tracking should avoid filler charts and KPI noise.

## Phase 9: Responsive Web and Mobile Strategy

### Goal

Ship one strong responsive web app now and preserve a clean path to a later mobile app.

### Current Recommendation

- web-first product
- responsive all the way through
- learner surfaces optimized for mobile/tablet
- parent surfaces optimized for tablet/laptop first
- no separate native app in this roadmap

### What "Mobile Ready" Means Here

- no horizontal overflow
- touch-friendly controls
- stable sticky elements
- readable lesson width on phones
- activity interactions usable without mouse precision
- auth and learner switching work on mobile browsers

### Native App Readiness Work

- keep domain logic and contracts shared
- avoid coupling core behavior to desktop-only layout patterns
- keep API boundaries clean enough for a later Expo client

## Cross-Cutting Checklists

### Studio Mode Checklist

- server-side access model exists
- local dev override exists
- studio toggle exists
- panels are additive, not structural
- prompt previews moved out of default page content
- runtime trace links exist
- raw JSON/artifact inspectors exist

### Deployment Checklist

- staging environment running
- preview deploys working
- Supabase hosted project configured
- auth callbacks and site URLs correct
- migration process documented
- logs/monitoring available
- backups/rollback documented

### UX Checklist

- shell is quiet
- no marketing-style hero sections inside the app
- no dashboard filler
- reading surfaces exist for lesson-heavy flows
- secondary detail collapses by default
- debug info appears only in studio mode

## Work Breakdown By Week

### Week 1

- lock launch scope
- write studio mode rules
- design auth and tenancy approach
- define deployment topology and env matrix

### Week 2

- implement Supabase SSR auth
- add sign-in/sign-out/confirm flows
- resolve adult user and memberships
- keep learner selection as workspace state

### Week 3

- implement RLS and storage policies
- audit service-role use
- set up staging deployment

### Week 4

- implement studio mode primitives
- move current prompt/debug surfaces into studio panels
- add traceability and internal inspection paths

### Week 5

- redesign parent shell
- redesign Today workspace
- keep studio mode available throughout the redesign

### Week 6

- redesign learner activity flow
- refresh copilot
- responsive audit
- staging QA and launch checklist

## Suggested Execution Backlog

Work through these in order:

1. write the launch scope and out-of-scope list
2. define studio access rules
3. implement studio context and gating helpers
4. implement Supabase SSR auth flow
5. replace cookie-only session identity
6. add RLS and storage policies
7. stand up staging
8. move lesson-plan debug UI into studio panels
9. move curriculum and copilot debug into studio panels
10. redesign parent shell
11. redesign Today
12. redesign learner activity
13. redesign remaining parent surfaces
14. run full staging QA

## What We Should Do Next

The next practical step is not the full redesign. It is:

1. convert this roadmap into a tracked implementation checklist
2. define the exact studio access model
3. implement studio infrastructure before the major UX pass

Once that exists, the redesign can move fast without losing the debug visibility you rely on.
