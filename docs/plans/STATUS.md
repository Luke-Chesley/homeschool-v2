# Work Status

Use this file as the shared coordination board for all parallel plan execution.

## Rules

1. Always check this file on `main` before starting work.
2. If you are taking a task, update its status on `main` first.
3. Set the task to `in_progress`, fill in `owner`, `branch`, and `last_updated`.
4. Commit that claim on `main` so other agents can see it before you branch off.
5. When the task is merged back, update the status on `main` to `done`.
6. If you stop or abandon a task, change it back to `not_started` or `blocked` and leave a short note.

## Claim Workflow

```bash
git checkout main
git pull --ff-only

# edit docs/plans/STATUS.md
# change one task to in_progress and add owner/branch/last_updated

git add docs/plans/STATUS.md
git commit -m "coord: claim 05-planning-and-daily-workspace"
git push

git checkout -b ai/05-planning-and-daily-workspace
```

## Complete Workflow

```bash
git checkout main
git pull --ff-only
git merge ai/05-planning-and-daily-workspace

# edit docs/plans/STATUS.md
# change status to done and update last_updated/notes

git add docs/plans/STATUS.md
git commit -m "coord: complete 05-planning-and-daily-workspace"
git push
```

## Status Values

- `not_started`
- `in_progress`
- `blocked`
- `done`

## Workstreams

| Workstream | Status | Owner | Branch | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- |
| `01-platform-and-local-dev` | `done` | `platform-a` | `ai/01-platform-and-local-dev` | `2026-03-30 15:36 PDT` | `Merged local Supabase, env, auth, storage, and Inngest foundation.` |
| `02-data-model-and-repositories` | `done` | `platform-a` | `ai/02-data-model-and-repositories` | `2026-03-30 15:48 PDT` | `Merged canonical Drizzle schema, repositories, and initial migration.` |
| `03-parent-workspace-shell` | `done` | `platform-a` | `ai/03-parent-workspace-shell` | `2026-03-30 16:00 PDT` | `Merged shared parent route-group layout, navigation, responsive shell, and reserved right-rail space.` |
| `04-curriculum-and-standards` | `done` | `platform-b` | `ai/04-curriculum-and-standards` | `2026-03-30 16:15 PDT` | `Merged curriculum library UI, tree model, standards browsing, mock adapters.` |
| `05-planning-and-daily-workspace` | `done` | `platform-c` | `ai/05-planning-and-daily-workspace` | `2026-03-30 16:42 PDT` | `Merged weekly planning, day planning, and the daily workspace. Full verification is currently blocked by unrelated learner-activity type errors.` |
| `06-learner-activity-engine` | `in_progress` | `platform-b` | `ai/06-learner-activity-engine` | `2026-03-30 16:20 PDT` | `Claimed for learner route group, activity renderer, and attempt capture.` |
| `07-tracking-and-reporting` | `not_started` |  |  |  |  |
| `08-ai-platform-and-copilot` | `not_started` |  |  |  |  |
