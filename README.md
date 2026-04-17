# Homeschool V2

`homeschool-v2` is the product app. It owns UI, app routes, auth/session handling, product persistence, and user-facing records.

`learning-core` is a separate Python service. It owns:
- AI runtime
- skill registry
- `SKILL.md` instructions
- prompt assembly
- provider/model selection
- prompt preview generation
- execution, lineage, and trace output

This repo no longer owns extracted prompt templates or a generic AI gateway.

## Read This First

- `app/(parent)` and `app/(learner)` are route groups, not URL segments.
- The parent shell lives in `app/(parent)/layout.tsx`.
- `http://localhost:3000` is reserved for the main checkout at `/home/luke/Desktop/learning/homeschool-v2`.
- AI provider keys and model config belong in `learning-core`, not here.
- `homeschool-v2` should only carry the service boundary env:
  - `LEARNING_CORE_BASE_URL`
  - `LEARNING_CORE_API_KEY` if the core is locked down

## Route Map

| URL | Open These Files First |
| --- | --- |
| `/today` | `app/(parent)/today/page.tsx`, `app/(parent)/today/actions.ts`, `lib/planning/today-service.ts`, `lib/learning-core/activity.ts` |
| `/planning` | `app/(parent)/planning/page.tsx`, `components/planning/`, `lib/planning/`, `app/api/ai/lesson-plan/route.ts`, `lib/learning-core/session.ts` |
| `/curriculum` | `app/(parent)/curriculum/page.tsx`, `components/curriculum/`, `lib/curriculum/ai-draft-service.ts`, `lib/curriculum/progression-regeneration.ts`, `lib/learning-core/curriculum.ts` |
| `/tracking` | `app/(parent)/tracking/page.tsx`, `components/tracking/`, `lib/tracking/`, `lib/compliance/`, `lib/homeschool/attendance/` |
| `/copilot` | `app/(parent)/copilot/page.tsx`, `components/copilot/`, `components/debug/`, `app/api/ai/chat/route.ts`, `lib/learning-core/copilot.ts`, `lib/ai/copilot-store.ts` |
| `/activity/[sessionId]` | `app/(learner)/activity/[sessionId]/page.tsx`, `components/activities/`, `lib/activities/`, `app/api/activities/attempts/[attemptId]/feedback/route.ts`, `lib/learning-core/activity-feedback.ts` |
| `/users` | `app/users/page.tsx`, `components/users/`, `lib/users/` |
| `/onboarding` | `app/onboarding/page.tsx`, `lib/homeschool/onboarding/`, `app/api/homeschool/onboarding/route.ts`, `lib/learning-core/curriculum.ts` |
| `/auth/login` | `app/auth/login/page.tsx`, `components/auth/AuthCredentialsForm.tsx`, `lib/auth/browser.ts`, `middleware.ts` |
| `/auth/sign-up` | `app/auth/sign-up/page.tsx`, `components/auth/AuthCredentialsForm.tsx`, `app/auth/confirm/route.ts`, `middleware.ts` |
| `/auth/setup` | `app/auth/setup/page.tsx`, `components/auth/AuthSetupForm.tsx`, `app/api/auth/setup/route.ts`, `lib/auth/identity.ts` |
| `/sample-activity` | `app/sample-activity/page.tsx`, `components/activities/`, `lib/activities/` |

## Where To Start

- Today workspace and activity generation:
  `app/(parent)/today/page.tsx`, `app/(parent)/today/actions.ts`, `lib/planning/today-service.ts`, `lib/learning-core/activity.ts`
- Lesson-plan generation:
  `app/api/ai/lesson-plan/route.ts`, `lib/learning-core/session.ts`, `components/planning/lesson-plan-panel.tsx`
- Curriculum generation and revision:
  `app/api/curriculum/`, `lib/curriculum/ai-draft-service.ts`, `lib/curriculum/progression-regeneration.ts`, `lib/learning-core/curriculum.ts`
- Copilot:
  `app/(parent)/copilot/page.tsx`, `app/api/ai/chat/route.ts`, `lib/learning-core/copilot.ts`, `lib/ai/copilot-store.ts`
- App session and auth bootstrap:
  `app/api/app-session/route.ts`, `lib/app-session/`, `lib/auth/`, `middleware.ts`, `app/auth/`
- Database shape and repositories:
  `lib/db/schema/`, `lib/db/repositories/`, `lib/db/server.ts`

## AI Boundary

The boundary is now strict:

- `learning-core` owns extracted operations, prompts, prompt previews, providers, models, lineage, and traces.
- `homeschool-v2` sends typed request envelopes, persists returned artifacts, and renders debug views using the exact prompt preview returned by `learning-core`.

If you are tracing an AI flow in this repo:

- `lib/learning-core/`
  Thin typed HTTP clients for operation preview/execute.
- `lib/learning-core/activity-feedback.ts`
  Typed runtime feedback client for learner component answers.
- `app/api/ai/chat/route.ts`
  Copilot request entrypoint. Sends structured chat context to `learning-core`.
- `app/api/ai/lesson-plan/route.ts`
  Session-generation entrypoint. Sends structured planning context to `learning-core`.
- `app/api/curriculum/*`
  Curriculum/progression revision and preview entrypoints. These call `learning-core` through typed clients.
- `components/debug/LearningCorePromptPreviewCard.tsx`
  Shared debug view for request envelope, effective prompts, lineage, and trace data returned by `learning-core`.

What you should not look for here anymore:

- app-owned prompt templates for extracted tasks
- provider SDK routing
- generic `/v1/gateway` proxying
- local AI generation-job orchestration for extracted flows

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
  Planning services, weekly routes, and today workspace logic.
- `lib/curriculum/`
  Curriculum persistence, normalization, source management, and app-side orchestration around `learning-core`.
- `lib/learning-core/`
  Typed boundary to the external AI service.
- `lib/activities/`
  Activity definitions, parsing, validation, and rendering support.
- `lib/tracking/`
  Tracking dashboard assembly, subject coverage, and export/report shaping.
- `lib/compliance/`
  Learner-year compliance programs, requirement profiles, attendance summaries, portfolio actions, deadlines, and report draft helpers.
- `lib/homeschool/`
  Onboarding, attendance APIs, reporting exports, and homeschool-specific flows layered around the generic compliance record.
- `contracts/`
  Contracts for generated artifacts. Update these when artifact shape or lifecycle changes.
- `docs/`
  Architecture notes, beta scorecards, product documents, and implementation history.
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
- For local auth flows, start the Supabase stack with `corepack pnpm dev:stack` and copy the publishable/secret keys from `corepack pnpm dev:stack:status` into `.env.local`.
- Local app startup still applies repo SQL files from `drizzle/*.sql` automatically. Hosted startup does not. Staging and production databases must be provisioned or migrated before the Vercel app boots.
- Stripe billing is optional in local development. If you want real hosted checkout and webhook flows, add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_FOUNDING_HOUSEHOLD_ANNUAL_PRICE_ID` to `.env.local`.
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
