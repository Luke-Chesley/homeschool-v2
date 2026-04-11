# 02 Data Model and Repositories

## Branch Workflow

If this directory is not already a Git repo, run `git init` and rename the default branch to `main` once before using this workflow.

1. `git checkout main`
2. `git pull --ff-only`
3. Check [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md). If this task is available, update it on `main` to `in_progress` with your owner name, branch name, and timestamp.
4. Commit the `STATUS.md` claim on `main`.
5. `git checkout -b ai/02-data-model-and-repositories`
6. Implement only the owned scope below.
7. Commit your work.
8. `git checkout main`
9. `git merge ai/02-data-model-and-repositories`
10. Resolve any conflicts, rerun checks, and commit the merge.
11. Update [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md) on `main` to `done`, then commit that update.

## Goal

Create the canonical relational model and repository layer for the full product so the rest of the app has stable persistence contracts.

## Owned Write Scope

- `lib/db/**`
- `drizzle/**`

## Avoid Editing

- Root config and dependency files
- `app/**`
- `components/**`
- `lib/auth/**`
- `lib/storage/**`
- `lib/curriculum/**`
- `lib/planning/**`
- `lib/tracking/**`
- `lib/activities/**`
- `lib/ai/**`

## Deliverables

- Drizzle schema for organizations, memberships, learners, goals, standards, curriculum, plans, lesson sessions, artifacts, activities, progress, conversations, and recommendations
- Migration files and migration workflow
- Repository modules for each major domain area
- Shared database helpers for transactions, IDs, timestamps, and common query patterns
- Seed or fixture approach inside `lib/db` if useful for local development

## Acceptance Checklist

- The schema supports the entities listed in the master plan
- The schema is Postgres-first and compatible with local Supabase
- Repositories are grouped by domain and avoid leaking SQL into feature code
- Artifact, activity, planning, and tracking data can be linked by stable IDs
- The data layer is ready for row-level security work later even if RLS is not fully implemented yet

## Parallelization Notes

- Assume feature teams may temporarily use mocks until this branch is merged.
- Keep repository interfaces ergonomic for server actions, route handlers, and jobs.
- Do not build feature UI in this task.
