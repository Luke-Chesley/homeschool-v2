# 04 Curriculum and Standards

Archive note: this plan references the historical `docs/plans/STATUS.md` coordination board, which is no longer present in the repo.

## Branch Workflow

If this directory is not already a Git repo, run `git init` and rename the default branch to `main` once before using this workflow.

1. `git checkout main`
2. `git pull --ff-only`
3. Historical workflow: check `docs/plans/STATUS.md` on `main`. That coordination file is no longer present in the current repo.
4. Commit the `STATUS.md` claim on `main`.
5. `git checkout -b ai/04-curriculum-and-standards`
6. Implement only the owned scope below.
7. Commit your work.
8. `git checkout main`
9. `git merge ai/04-curriculum-and-standards`
10. Resolve any conflicts, rerun checks, and commit the merge.
11. Historical workflow: update `docs/plans/STATUS.md` on `main` to `done`, then commit that update.

## Goal

Build the curriculum and standards domain surfaces so parents can bring in source material, organize it, and map it to goals and standards.

## Owned Write Scope

- `app/(parent)/curriculum/**`
- `components/curriculum/**`
- `lib/curriculum/**`
- `lib/standards/**`

## Avoid Editing

- `package.json`
- `lib/db/**`
- Shared parent shell files
- `app/(parent)/planning/**`
- `app/(parent)/today/**`
- `app/(parent)/tracking/**`
- `app/(parent)/copilot/**`
- `lib/ai/**`

## Deliverables

- Curriculum library UI for manual entry, upload intake, and AI-draft entry points
- Curriculum tree model helpers for source -> unit -> lesson/objective structure
- Standards browsing/mapping UI and helper functions
- Feature-scoped service/adapters for curriculum and standards operations
- Placeholder or real retrieval preparation hooks for chunking/indexing workflows

## Acceptance Checklist

- A parent can create or view curriculum structure in the UI
- Standards or custom goals can be attached to curriculum items
- The feature can run with mock adapters if the repository layer is not merged yet
- The implementation leaves obvious integration points for ingestion jobs and retrieval indexing
- Curriculum data is treated as durable system data, not just prompt text

## Parallelization Notes

- If the data layer is not ready, define feature-local interfaces and mock implementations under `lib/curriculum`.
- Do not build planning views here.
