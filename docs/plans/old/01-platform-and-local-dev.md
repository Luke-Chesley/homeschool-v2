# 01 Platform and Local Dev

## Branch Workflow

If this directory is not already a Git repo, run `git init` and rename the default branch to `main` once before using this workflow.

1. `git checkout main`
2. `git pull --ff-only`
3. Check [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md). If this task is available, update it on `main` to `in_progress` with your owner name, branch name, and timestamp.
4. Commit the `STATUS.md` claim on `main`.
5. `git checkout -b ai/01-platform-and-local-dev`
6. Implement only the owned scope below.
7. Commit your work.
8. `git checkout main`
9. `git merge ai/01-platform-and-local-dev`
10. Resolve any conflicts, rerun checks, and commit the merge.
11. Update [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md) on `main` to `done`, then commit that update.

## Goal

Set up the local-first platform foundation so the app can run against local Supabase and local background tooling now, while preserving an easy path to hosted Supabase later.

## Owned Write Scope

- `.env.example`
- `Makefile`
- `package.json`
- `pnpm-lock.yaml`
- `scripts/**`
- `supabase/**`
- `drizzle.config.*`
- `inngest.config.*`
- `lib/env/**`
- `lib/auth/**`
- `lib/storage/**`
- `lib/platform/**`

## Avoid Editing

- `lib/db/**`
- `app/(parent)/**`
- `app/(learner)/**`
- `components/**` outside any platform-only helper
- `lib/curriculum/**`
- `lib/planning/**`
- `lib/tracking/**`
- `lib/activities/**`
- `lib/ai/**`

## Deliverables

- Local Supabase development workflow with clear startup commands and environment variables
- Config-driven separation between local Supabase and hosted Supabase
- Auth helpers for server/client session access behind `lib/auth`
- Storage helpers behind `lib/storage`
- Environment validation/helpers behind `lib/env`
- Inngest local development bootstrap
- Developer scripts and make targets for starting local services and the app

## Acceptance Checklist

- A developer can boot the project locally with documented commands
- The codebase has clear `lib/auth`, `lib/storage`, and `lib/env` boundaries
- No feature code depends directly on raw env variable access outside platform helpers
- Local-vs-hosted switching is environment-driven rather than hardcoded
- No SQLite or checked-in stateful DB files are introduced

## Parallelization Notes

- Do not block on the database schema task.
- Provide platform boundaries and startup flow only.
- If a dependency package is needed for another task, add it here rather than having multiple workers edit `package.json`.
