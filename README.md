# Homeschool V2

Homeschool V2 is the Next.js app for the product. It owns the UI, app routes, auth/session handling, product data, and app-facing endpoints.

`learning-core` is now a separate Python service. It owns provider SDKs, model execution, and the extracted AI runtime.

## Read This First

- `app/(parent)` and `app/(learner)` are route groups, not URL segments.
- The parent workspace gate and shell live in `app/(parent)/layout.tsx`.
- `http://localhost:3000` is reserved for the main checkout at `/home/luke/Desktop/homeschool-v2`.
- AI provider credentials and model config no longer belong in this repo. They belong in `learning-core`.

## Route Map

| URL | Open These Files First |
| --- | --- |
| `/today` | `app/(parent)/today/page.tsx`, `app/(parent)/today/actions.ts`, `lib/planning/today-service.ts` |
| `/planning` | `app/(parent)/planning/page.tsx`, `components/planning/`, `lib/planning/` |
| `/curriculum` | `app/(parent)/curriculum/page.tsx`, `components/curriculum/`, `lib/curriculum/` |
| `/tracking` | `app/(parent)/tracking/page.tsx`, `components/tracking/`, `lib/tracking/`, `lib/homeschool/attendance/` |
| `/copilot` | `app/(parent)/copilot/page.tsx`, `components/copilot/`, `lib/ai/task-service.ts`, `lib/prompts/store.ts`, `lib/learning-core/` |
| `/users` | `app/users/page.tsx`, `components/users/`, `lib/users/` |
| `/onboarding` | `app/onboarding/page.tsx`, `lib/homeschool/onboarding/`, `app/api/homeschool/onboarding/route.ts` |
| `/sample-activity` | `app/sample-activity/page.tsx`, `components/activities/`, `lib/activities/` |

## Where To Start

If you are trying to change one part of the app, start here instead of scanning the whole repo.

- Today workspace and lesson planning:
  `app/(parent)/today/page.tsx`, `app/(parent)/today/actions.ts`, `lib/planning/today-service.ts`
- Parent shell, redirects, and workspace access:
  `app/(parent)/layout.tsx`, `components/parent-shell/`, `components/navigation/`
- Learner management:
  `app/users/page.tsx`, `lib/users/service.ts`, `app/api/users/route.ts`
- App session and auth bootstrap:
  `app/api/app-session/route.ts`, `lib/app-session/`, `lib/auth/`
- Curriculum generation, review, and source updates:
  `app/api/curriculum/`, `lib/curriculum/ai-draft-service.ts`, `lib/curriculum/service.ts`
- Copilot chat and AI job entrypoints:
  `app/api/ai/`, `lib/ai/task-service.ts`, `lib/ai/copilot-store.ts`
- Activity rendering and activity data:
  `components/activities/`, `lib/activities/`, `lib/learning-core/activity.ts`
- Database shape and repositories:
  `lib/db/schema/`, `lib/db/repositories/`, `lib/db/server.ts`

## AI Boundary

The repo is mid-migration. The important ownership line is:

- `learning-core` owns provider SDKs, provider env, model execution, and extracted skill logic.
- `homeschool-v2` owns app routes, app endpoints, persistence, prompt previews, and the remaining orchestration that has not moved yet.

If you are looking for AI-related code:

- `lib/learning-core/`
  The HTTP client boundary to the external Python service.
- `lib/ai/task-service.ts`
  Remaining app-side orchestration for chat, job dispatch, lesson draft generation, worksheet generation, and other app workflows.
- `lib/prompts/`
  Legacy prompt and preview templates that are still used locally by curriculum and copilot flows.
- `app/api/ai/*` and `app/api/curriculum/*`
  App-facing endpoints. These are entrypoints and wrappers around app behavior. They are not provider SDK implementations.

## Key Directories

- `app/`
  Pages, layouts, server actions, and API routes.
- `components/`
  Feature UI and shared UI primitives.
- `lib/app-session/`
  Active workspace and learner/session resolution.
- `lib/auth/`
  Browser/server/admin auth helpers.
- `lib/db/`
  Database schema, repositories, and DB helpers.
- `lib/planning/`
  Planning services, weekly routes, and today workspace logic.
- `lib/curriculum/`
  Curriculum services, AI draft orchestration, import logic, and source management.
- `lib/activities/`
  Activity definitions, parsing, and rendering support.
- `lib/tracking/`
  Tracking and reporting logic.
- `lib/homeschool/`
  Onboarding, attendance, reporting, and homeschool-specific flows.
- `contracts/`
  Contracts for AI-generated artifacts. Update these when artifact shape or lifecycle changes.
- `docs/`
  Plans, architecture notes, and product documentation.

## Workspace Files And Local Clutter

These exist in the repo, but they are not the main product code path:

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

- Start the main app from `/home/luke/Desktop/homeschool-v2` with `corepack pnpm dev` or `make dev`.
- Branch worktrees under `.worktrees/` must run on their own port, not `3000`.
- Local split development is two processes:
  `homeschool-v2` on `http://localhost:3000` and `learning-core` on `http://127.0.0.1:8000`.
- `homeschool-v2` should only carry the service boundary env:
  `LEARNING_CORE_BASE_URL` and optionally `LEARNING_CORE_API_KEY`.
- The minimum verification gate is `corepack pnpm typecheck`.
- Before merging a branch into `main`, run `bash ./scripts/verify-before-merge.sh` from the main checkout.
- If major structure or ownership changes, update this README in the same task.
