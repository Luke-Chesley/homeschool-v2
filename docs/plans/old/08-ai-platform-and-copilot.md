# 08 AI Platform and Copilot

Archive note: this plan references the historical `docs/plans/STATUS.md` coordination board, which is no longer present in the repo.

## Branch Workflow

If this directory is not already a Git repo, run `git init` and rename the default branch to `main` once before using this workflow.

1. `git checkout main`
2. `git pull --ff-only`
3. Historical workflow: check `docs/plans/STATUS.md` on `main`. That coordination file is no longer present in the current repo.
4. Commit the `STATUS.md` claim on `main`.
5. `git checkout -b ai/08-ai-platform-and-copilot`
6. Implement only the owned scope below.
7. Commit your work.
8. `git checkout main`
9. `git merge ai/08-ai-platform-and-copilot`
10. Resolve any conflicts, rerun checks, and commit the merge.
11. Historical workflow: update `docs/plans/STATUS.md` on `main` to `done`, then commit that update.

## Goal

Build the provider-agnostic AI layer and the user-facing copilot surfaces that connect planning, generation, interactives, and adaptation.

## Owned Write Scope

- `app/(parent)/copilot/**`
- `app/api/ai/**`
- `components/copilot/**`
- `lib/ai/**`
- `lib/prompts/**`

## Avoid Editing

- `package.json` unless coordinated through the platform task
- `lib/db/**`
- `app/(parent)/planning/**`
- `app/(parent)/today/**`
- `app/(parent)/tracking/**`
- `components/planning/**`
- `components/tracking/**`

## Deliverables

- Task registry for lesson drafting, worksheet generation, interactive generation, adaptation, summarization, standards suggestions, and chat answers
- Provider-agnostic adapter interface and model routing configuration
- Prompt/version storage conventions and artifact lineage conventions
- Streaming chat UI for the parent workspace
- Structured copilot actions that can later plug into planning, tracking, and artifact systems

## Acceptance Checklist

- The AI layer is task-oriented rather than one giant prompt helper
- Chat UX supports contextual interactions and streaming responses
- Structured action shapes exist for plan modification, artifact creation, and recommendation generation
- Long-running generation work is modeled for async jobs rather than blocking requests
- The implementation can run with mocks or placeholder persistence until the data layer is merged

## Parallelization Notes

- Do not hardwire the AI layer to a single provider.
- Keep chat output separate from durable action/artifact records, even if persistence is stubbed at first.
