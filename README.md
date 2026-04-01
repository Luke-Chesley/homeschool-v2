# Homeschool V2

Homeschool V2 is a Next.js App Router repo for a planning-first homeschool platform. This README is meant to answer the practical question: where does stuff live, and what controls what?

## What This Repo Is

- `app/` holds routes, layouts, and API handlers.
- `components/` holds UI, grouped by feature area.
- `lib/` holds domain logic, session/auth code, DB access, and integration helpers.
- `docs/` holds plans and architecture/product notes.
- `scripts/`, `supabase/`, and `drizzle/` hold local dev and data infrastructure.

## High-Level Mental Model

Most features in this repo follow the same path:

1. A route in `app/` renders a page or handles a request.
2. That route uses UI from `components/<feature>/`.
3. Page and API logic call service/domain code in `lib/<feature>/`.
4. Session and auth context come from `lib/app-session/` and `lib/auth/`.
5. Data access goes through `lib/db/` repositories, schema, and server DB helpers.

If you want to understand how a feature works, look at those layers in that order.

## Repo Structure

### `app/`

This is the main entrypoint for the product.

- `app/layout.tsx`
  Root layout for the whole app.
- `app/page.tsx`
  Public landing page.
- `app/(parent)/`
  Parent/admin workspace routes such as today, curriculum, planning, tracking, and copilot.
- `app/(learner)/`
  Learner-facing routes with a simplified shell.
- `app/api/`
  Server route handlers for app session state, users, curriculum, AI chat, activities, and other server mutations.
- `app/users/`
  Learner/user management surface.
- `app/sample-activity/`
  Activity/testing surface.

### `components/`

Feature UI and shared UI primitives.

- `components/ui/`
  Shared low-level components.
- `components/navigation/`
  Global tabs and nav configuration.
- `components/parent-shell/`
  Parent workspace shell, sidebar, and topbar.
- `components/activities/`
  Activity UI.
- `components/planning/`
  Planning-related UI.
- `components/curriculum/`
  Curriculum UI and source-management components.
- `components/tracking/`
  Tracking/reporting UI.
- `components/copilot/`
  AI/copilot UI.
- `components/users/`
  Learner/user management UI.
- `components/theme/`
  Theme toggle and theme-related client behavior.

### `lib/`

Most non-UI logic lives here.

- `lib/app-session/`
  App workspace/session resolution, including active learner context.
- `lib/auth/`
  Browser/server/admin auth helpers.
- `lib/db/`
  Database client setup, schema, repositories, and DB-facing helpers.
- `lib/env/`
  Environment parsing and validation.
- `lib/platform/`
  Platform integrations such as Supabase setup.
- `lib/users/`
  Workspace bootstrapping, learner creation, and user-related service logic.
- `lib/activities/`
  Activity/session/domain logic.
- `lib/planning/`
  Planning domain types, repositories, and services.
- `lib/curriculum/`
  Curriculum domain types, services, import logic, and repositories.
- `lib/tracking/`
  Tracking/reporting domain logic.
- `lib/ai/`
  AI/copilot task and store logic.
- `lib/standards/`
  Standards-related domain logic.
- `lib/storage/`
  Storage client helpers.
- `lib/prompts/`
  Prompt definitions and prompt management.

### `docs/`

Project documentation and implementation notes.

- `docs/plans/`
  Working plan documents for major slices of the product.

### `scripts/`

Local dev helpers for:

- Supabase stack control
- Inngest dev process
- local tool and environment checks

### `supabase/`

Local Supabase configuration for local stack development.

### `drizzle/`

Drizzle migration metadata and generated data-layer artifacts.

## Local Workspace And Non-Product Directories

These matter during development, but they are not app feature code:

- `.worktrees/`
  Temporary git worktrees for isolated branch work. The canonical `main` checkout is `/home/luke/Desktop/homeschool-v2`.
- `.next/`
  Next.js dev/build output.
- `node_modules/`
  Installed dependencies.
- `.playwright-cli/`
  Local browser automation support files.

## Common Control Points

If you are trying to find the source of behavior, these are the usual starting points:

- Route access and shell choice:
  `app/layout.tsx`, `app/(parent)/layout.tsx`, `app/(learner)/layout.tsx`

- Auth and app session loading:
  `lib/auth/`, `lib/app-session/`, `app/api/app-session/`

- Database-backed data access:
  `lib/db/server.ts`, `lib/db/schema/`, `lib/db/repositories/`

- Feature logic:
  `lib/<feature>/`, `components/<feature>/`, and matching `app/...` routes

- API entrypoints:
  `app/api/**/route.ts`

## Development Notes

- `http://localhost:3000` is reserved for the main checkout.
- Branch worktrees under `.worktrees/` should use their own ports.
- The minimum verification gate is currently `corepack pnpm typecheck`.
- Before merging a branch back to `main`, run `bash ./scripts/verify-before-merge.sh` from the target checkout so the typecheck and UI smoke test both pass.
- If major structure or subsystem ownership changes, update this README in the same task.
