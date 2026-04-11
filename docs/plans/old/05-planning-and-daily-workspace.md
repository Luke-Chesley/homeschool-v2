# 05 Planning and Daily Workspace

## Branch Workflow

If this directory is not already a Git repo, run `git init` and rename the default branch to `main` once before using this workflow.

1. `git checkout main`
2. `git pull --ff-only`
3. Check [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md). If this task is available, update it on `main` to `in_progress` with your owner name, branch name, and timestamp.
4. Commit the `STATUS.md` claim on `main`.
5. `git checkout -b ai/05-planning-and-daily-workspace`
6. Implement only the owned scope below.
7. Commit your work.
8. `git checkout main`
9. `git merge ai/05-planning-and-daily-workspace`
10. Resolve any conflicts, rerun checks, and commit the merge.
11. Update [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md) on `main` to `done`, then commit that update.

## Goal

Build the planning surfaces and the daily lesson workspace that act as the operational center of the product.

## Owned Write Scope

- `app/(parent)/planning/**`
- `app/(parent)/today/**`
- `components/planning/**`
- `lib/planning/**`

## Avoid Editing

- Shared parent shell files
- `app/(parent)/curriculum/**`
- `app/(parent)/tracking/**`
- `app/(parent)/copilot/**`
- `components/tracking/**`
- `components/copilot/**`
- `lib/db/**`
- `lib/ai/**`

## Deliverables

- Weekly and daily planning views
- Planning helpers for pacing, constraints, carryover, and recovery flows
- Daily workspace screen for lesson execution
- UI affordances for rescheduling, compression, expansion, and recovery planning
- Clear insertion points for generated artifacts and future copilot actions

## Acceptance Checklist

- Plans can be represented as dated items with enough metadata for downstream generation
- The daily workspace can display lesson context, actions, and completion affordances
- Planning logic is deterministic first, with room for AI recommendation later
- The feature works with mock data if repositories are not ready
- The page structure makes later integration with copilot and tracking straightforward

## Parallelization Notes

- Reserve space for artifact panels and copilot, but do not build the copilot itself here.
- Use feature-local mock services if needed.
