# 07 Tracking and Reporting

Archive note: this plan references the historical `docs/plans/STATUS.md` coordination board, which is no longer present in the repo.

## Branch Workflow

If this directory is not already a Git repo, run `git init` and rename the default branch to `main` once before using this workflow.

1. `git checkout main`
2. `git pull --ff-only`
3. Historical workflow: check `docs/plans/STATUS.md` on `main`. That coordination file is no longer present in the current repo.
4. Commit the `STATUS.md` claim on `main`.
5. `git checkout -b ai/07-tracking-and-reporting`
6. Implement only the owned scope below.
7. Commit your work.
8. `git checkout main`
9. `git merge ai/07-tracking-and-reporting`
10. Resolve any conflicts, rerun checks, and commit the merge.
11. Historical workflow: update `docs/plans/STATUS.md` on `main` to `done`, then commit that update.

## Goal

Build the accountability layer that records what happened, shows progress and coverage, and supports reporting/export needs.

## Owned Write Scope

- `app/(parent)/tracking/**`
- `components/tracking/**`
- `lib/tracking/**`

## Avoid Editing

- Shared parent shell files
- `app/(parent)/curriculum/**`
- `app/(parent)/planning/**`
- `app/(parent)/today/**`
- `app/(parent)/copilot/**`
- `lib/db/**`
- `lib/ai/**`
- `lib/activities/**`

## Deliverables

- Tracking views for completion history, observations, and evidence
- Reporting views for standards coverage, gaps, and progress summaries
- Export-oriented data shaping helpers
- Tracking domain helpers for status, time spent, mastery signal, notes, and deviations
- UI patterns for connecting lessons and activities back to standards/goals

## Acceptance Checklist

- The feature can represent planned-vs-actual outcomes clearly
- Standards and goals are visible in reporting flows
- The implementation can run with mocks if data repositories are not merged yet
- Reporting surfaces support household and broader organization use cases
- The feature leaves obvious integration points for learner activity outcomes and future AI adaptation analysis

## Parallelization Notes

- Do not build the AI recommendation engine here.
- Focus on durable records, evidence, and reporting surfaces.
