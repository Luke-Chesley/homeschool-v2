# Homeschool V2

`homeschool-v2` is the homeschool product app.
It owns product UI, routes, auth/session handling, persistence, planning records, Today, tracking, and approved product mutations.

`learning-core` is the strict AI boundary.
It owns named operations, contracts, prompt assembly, provider/model selection, prompt previews, execution, lineage, and traces.

## Current Product Wedge

- bring what you already have
- create a usable curriculum and opening window
- open Today fast
- keep the week and records nearby

Billing code exists in the repo, but billing is deferred for the current closed-beta launch path.
Do not treat checkout, webhooks, pricing logic, or billing UI as part of the current product core.

## Read This First

- Current operational source of truth: `docs/CURRENT_PRODUCT_AND_RUNTIME_MODEL.md`
- Cross-repo code-level traces: `../docs/architecture/README.md`
- State invariants: `docs/CANONICAL_STATE.md`
- Launch eval gate: `docs/qa/BETA_LAUNCH_SCORECARD.md`
- `docs/VISION.md`, `docs/PRODUCT_IMPLEMENTATION_PLAN.md`, `docs/ARCHITECTURE.md`, and `docs/AGENTIC_PLATFORM_ARCHITECTURE.md` are broader or historical docs. Use them for direction, not for current implementation truth.
- `app/(parent)` and `app/(learner)` are route groups, not URL segments.
- `http://localhost:3000` is reserved for the main checkout at `/home/luke/Desktop/learning/homeschool-v2`.

## Current Product Chain

1. A parent brings in a source or a conversation-only request through onboarding or curriculum flows.
2. `homeschool-v2` normalizes product context and calls named `learning-core` operations.
3. `learning-core` runs `source_interpret` when source-entry classification is needed, then `curriculum_generate` for the durable curriculum artifact.
4. `homeschool-v2` imports the curriculum into app-owned records, persists progression, and opens the first practical slice of work through app-owned planning handoff.
5. Today uses `session_generate` for lesson drafts and `activity_generate` for lesson-scoped activities.
6. Tracking, notes, evidence, attendance, and schedule adjustments remain app-owned records.

Conversation-only intake still uses `curriculum_generate`, but skips `source_interpret`.

## Route Map

| URL | Open These Files First |
| --- | --- |
| `/` | `app/page.tsx`, `app/onboarding/page.tsx`, `lib/app-session/server.ts` |
| `/onboarding` | `app/onboarding/page.tsx`, `lib/homeschool/onboarding/`, `app/api/homeschool/onboarding/route.ts`, `lib/learning-core/source-interpret.ts`, `lib/learning-core/curriculum.ts` |
| `/today` | `app/(parent)/today/page.tsx`, `app/(parent)/today/actions.ts`, `lib/planning/today-service.ts`, `lib/planning/today-lesson-generation.ts`, `lib/planning/today-activity-generation.ts`, `lib/learning-core/session.ts`, `lib/learning-core/activity.ts` |
| `/planning` | `app/(parent)/planning/page.tsx`, `app/(parent)/planning/day/[date]/page.tsx`, `lib/planning/service.ts`, `lib/planning/weekly-route-service.ts`, `lib/planning/route-schedule-refresh.ts`, `lib/learning-core/session.ts` |
| `/curriculum` | `app/(parent)/curriculum/page.tsx`, `app/(parent)/curriculum/[sourceId]/page.tsx`, `components/curriculum/`, `lib/curriculum/service.ts`, `lib/curriculum/progression-regeneration.ts`, `lib/learning-core/curriculum.ts` |
| `/tracking` | `app/(parent)/tracking/page.tsx`, `app/(parent)/tracking/actions.ts`, `components/tracking/`, `lib/tracking/`, `lib/compliance/`, `lib/homeschool/attendance/` |
| `/assistant` | `app/(parent)/assistant/page.tsx`, `components/copilot/`, `app/api/ai/chat/route.ts`, `lib/learning-core/copilot.ts`, `lib/planning/copilot-snapshot.ts`, `lib/ai/copilot-store.ts` |
| `/activity/[sessionId]` | `app/(learner)/activity/[sessionId]/page.tsx`, `components/activities/`, `lib/activities/`, `app/api/activities/attempts/[attemptId]/feedback/route.ts`, `lib/learning-core/activity-feedback.ts`, `lib/learning-core/widget-transition.ts` |
| `/users` | `app/users/page.tsx`, `components/users/`, `lib/users/` |
| `/auth/login` | `app/auth/login/page.tsx`, `components/auth/AuthCredentialsForm.tsx`, `lib/auth/browser.ts`, `middleware.ts` |
| `/auth/sign-up` | `app/auth/sign-up/page.tsx`, `components/auth/AuthCredentialsForm.tsx`, `app/auth/confirm/route.ts`, `middleware.ts` |
| `/auth/setup` | `app/auth/setup/page.tsx`, `components/auth/AuthSetupForm.tsx`, `app/api/auth/setup/route.ts`, `lib/auth/identity.ts` |
| `/sample-activity` | `app/sample-activity/page.tsx`, `components/activities/`, `lib/activities/` |

## Where To Start

- Onboarding and source-entry curriculum creation:
  `app/onboarding/page.tsx`, `lib/homeschool/onboarding/`, `app/api/homeschool/onboarding/route.ts`, `lib/learning-core/source-interpret.ts`, `lib/learning-core/curriculum.ts`
- Curriculum persistence and progression:
  `app/(parent)/curriculum/page.tsx`, `lib/curriculum/service.ts`, `lib/curriculum/progression-regeneration.ts`, `lib/learning-core/curriculum.ts`
- Today workspace and lesson/activity generation:
  `app/(parent)/today/page.tsx`, `app/(parent)/today/actions.ts`, `lib/planning/today-service.ts`, `lib/planning/today-lesson-generation.ts`, `lib/planning/today-activity-generation.ts`
- Assistant:
  `app/(parent)/assistant/page.tsx`, `app/api/ai/chat/route.ts`, `lib/learning-core/copilot.ts`, `lib/planning/copilot-snapshot.ts`, `lib/ai/copilot-store.ts`
- App session and auth bootstrap:
  `app/api/app-session/route.ts`, `lib/app-session/`, `lib/auth/`, `middleware.ts`, `app/auth/`
- Database shape and repositories:
  `lib/db/schema/`, `lib/db/repositories/`, `lib/db/server.ts`

## AI Boundary

The boundary is strict:

- `learning-core` owns extracted operations, prompts, prompt previews, providers, models, lineage, and traces.
- `homeschool-v2` sends typed request envelopes, persists returned artifacts, and renders the prompt preview returned by `learning-core`.
- Curriculum creation is no longer an app-owned prompt flow. The current path is `source_interpret` plus `curriculum_generate`, followed by app-owned import and planning handoff.
- Assistant is a product surface, but meaningful state mutation must still go through explicit app-side handlers. Do not treat freeform chat text as permission to mutate planning, curriculum, or tracking state.

If you are tracing an AI flow in this repo:

- `lib/learning-core/`
  Thin typed HTTP clients for operation preview and execute.
- `app/api/homeschool/onboarding/route.ts`
  Onboarding request entrypoint for source-first curriculum creation.
- `app/api/ai/chat/route.ts`
  Assistant request entrypoint. Sends structured chat context to `learning-core`.
- `app/api/ai/lesson-plan/route.ts`
  Session-generation entrypoint for planning and Today lesson work.
- `app/api/curriculum/*`
  Curriculum revision, preview, and route-maintenance entrypoints around persisted app state.
- `components/debug/LearningCorePromptPreviewCard.tsx`
  Shared debug view for request envelopes, effective prompts, lineage, and trace data returned by `learning-core`.

What you should not look for here anymore:

- app-owned prompt templates for extracted tasks
- provider SDK routing
- generic `/v1/gateway` proxying
- billing-ready launch assumptions

## Key Directories

- `app/`
  Pages, layouts, server actions, and API routes.
- `components/`
  Feature UI and shared UI primitives.
- `lib/app-session/`
  Active workspace and learner/session resolution.
- `lib/auth/`
  Browser/server/admin auth helpers and authenticated identity resolution.
- `lib/db/`
  Database schema, repositories, and DB helpers.
- `lib/planning/`
  Planning services, weekly routes, Today materialization, and day-level scheduling.
- `lib/curriculum/`
  Curriculum persistence, normalization, progression, and app-side orchestration around `learning-core`.
- `lib/learning-core/`
  Typed boundary to the external AI service.
- `lib/activities/`
  Activity definitions, parsing, validation, and rendering support.
- `lib/tracking/`
  Tracking dashboard assembly, subject coverage, and export/report shaping.
- `lib/compliance/`
  Learner-year compliance programs, requirement profiles, attendance summaries, portfolio actions, deadlines, and report draft helpers.
- `lib/homeschool/`
  Onboarding, attendance APIs, reporting exports, and homeschool-specific workflows.
- `contracts/`
  Contracts for generated artifacts. Update these when artifact shape or lifecycle changes.
- `docs/`
  Current-state docs, architecture notes, beta scorecards, and implementation history.
- `docs/qa/`
  Reusable browser QA handoffs and responsive review instructions.

## Workspace Files And Local Clutter

- `.worktrees/`
  Temporary branch worktrees.
- `.agents/`, `.claude/`, `.codex/`
  Local agent tooling and instructions.
- `.next/`, `node_modules/`
  Build and dependency output.
- `curriculum.json`
  Local data/debug artifact.
- `skills-lock.json`
  Local tooling lock file.
- `ollama_debug_tui.py`
  Local debugging script.
- `tmp/`
  Scratch output from debug scripts.

## Development Notes

- Start the main app from `/home/luke/Desktop/learning/homeschool-v2` with `corepack pnpm dev` or `make dev`.
- For local auth flows, start the Supabase stack with `corepack pnpm dev:stack` and copy the publishable and secret keys from `corepack pnpm dev:stack:status` into `.env.local`.
- Local app startup still applies repo SQL files from `drizzle/*.sql` automatically. Hosted startup does not. Staging and production databases must be provisioned or migrated before the Vercel app boots.
- Billing remains deferred for the current launch path. Leave Stripe and checkout configuration out of scope unless you are explicitly working on the deferred billing surfaces.
- Local Supabase port cheat sheet:
  - `http://127.0.0.1:54321` is the project API URL and should be used for `NEXT_PUBLIC_SUPABASE_URL`
  - `postgresql://postgres:postgres@127.0.0.1:54322/postgres` is the local Postgres database
  - `http://127.0.0.1:54323` is Supabase Studio
  - `http://127.0.0.1:54324` is Mailpit
- Branch worktrees under `.worktrees/` must run on their own port, not `3000`.
- Split development is two processes:
  - `homeschool-v2` on `http://localhost:3000`
  - `learning-core` on `http://127.0.0.1:8000`
- Thin-shell mobile entry points:
  - `/open` resolves auth, setup, onboarding, learner switching, Today, and direct activity opens
  - `/api/mobile/bootstrap` returns one shell/bootstrap payload for auth, workspace, launch route, and `learning-core` status
- Minimum verification in this repo:
  - `corepack pnpm typecheck`
  - `corepack pnpm test:architecture`
  - `corepack pnpm verify:phase3:rls` when changing RLS or storage policies
- Beta operations helpers:
  - `corepack pnpm beta:cohort -- --org <organizationId> ...`
  - `corepack pnpm beta:scorecard -- --org <organizationId>`
- Before merging to `main`, run `bash ./scripts/verify-before-merge.sh` from the main checkout.
