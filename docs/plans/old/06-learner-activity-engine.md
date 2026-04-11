# 06 Learner Activity Engine

## Branch Workflow

If this directory is not already a Git repo, run `git init` and rename the default branch to `main` once before using this workflow.

1. `git checkout main`
2. `git pull --ff-only`
3. Check [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md). If this task is available, update it on `main` to `in_progress` with your owner name, branch name, and timestamp.
4. Commit the `STATUS.md` claim on `main`.
5. `git checkout -b ai/06-learner-activity-engine`
6. Implement only the owned scope below.
7. Commit your work.
8. `git checkout main`
9. `git merge ai/06-learner-activity-engine`
10. Resolve any conflicts, rerun checks, and commit the merge.
11. Update [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md) on `main` to `done`, then commit that update.

## Goal

Build the learner-facing activity runtime for structured and hybrid interactive lesson content.

## Owned Write Scope

- `app/(learner)/**`
- `components/activities/**`
- `lib/activities/**`

## Avoid Editing

- Parent workspace files
- `components/ui/**` unless a missing primitive makes progress impossible
- `lib/db/**`
- `lib/ai/**`
- `lib/tracking/**`

## Deliverables

- Learner route group and learner-safe layout
- Activity renderer for structured activity schemas
- Support for quizzes, matching, flashcards, sequencing, guided practice, and reflection flows
- Support for a bounded hybrid layout schema built from allowlisted components
- Attempt capture, autosave, and resume helpers inside the activity domain

## Acceptance Checklist

- Activities render from stored schema-like data rather than hardcoded per-page logic
- The learner mode can support assigned activity sessions cleanly
- Attempt state can be captured and resumed
- The implementation does not rely on arbitrary generated executable code
- The runtime can later report outcomes back into tracking without major rewrites

## Parallelization Notes

- Use local fixture data for activity definitions and attempt state if needed.
- Keep the activity engine generic enough that AI-generated content can target it later.
