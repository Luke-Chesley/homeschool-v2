# 03 Parent Workspace Shell

## Branch Workflow

If this directory is not already a Git repo, run `git init` and rename the default branch to `main` once before using this workflow.

1. `git checkout main`
2. `git pull --ff-only`
3. Check [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md). If this task is available, update it on `main` to `in_progress` with your owner name, branch name, and timestamp.
4. Commit the `STATUS.md` claim on `main`.
5. `git checkout -b ai/03-parent-workspace-shell`
6. Implement only the owned scope below.
7. Commit your work.
8. `git checkout main`
9. `git merge ai/03-parent-workspace-shell`
10. Resolve any conflicts, rerun checks, and commit the merge.
11. Update [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md) on `main` to `done`, then commit that update.

## Goal

Create the parent-facing app shell so the rest of the parent workspace features can drop into a consistent structure without fighting over layouts and navigation.

## Owned Write Scope

- `app/(parent)/layout.tsx`
- `app/(parent)/page.tsx`
- `components/parent-shell/**`
- `components/navigation/**`

## Avoid Editing

- Root layout and marketing pages unless absolutely necessary
- `app/(parent)/curriculum/**`
- `app/(parent)/planning/**`
- `app/(parent)/today/**`
- `app/(parent)/tracking/**`
- `app/(parent)/copilot/**`
- `components/curriculum/**`
- `components/planning/**`
- `components/tracking/**`
- `components/copilot/**`

## Deliverables

- Parent route group layout
- Sidebar, top navigation, and workspace container components
- Stable navigation destinations for curriculum, planning, daily workspace, tracking, and copilot
- Responsive shell behavior for desktop and mobile
- Placeholder landing screen for the parent workspace home

## Acceptance Checklist

- Feature teams can add pages under `app/(parent)` without rewriting layout code
- The shell feels intentional and reusable, not like a temporary admin scaffold
- Navigation labels match the master product plan
- The layout includes space for a future right rail or copilot surface
- The shell works without any backend integration

## Parallelization Notes

- Use static or mock data for nav counts and summaries if needed.
- Do not build feature-specific curriculum/planning/tracking screens here.
