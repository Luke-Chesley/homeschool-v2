# Parallel Work Plans Archive

These files are the archived parallel work packets from the earlier implementation split.

The live coordination board they originally referenced (`docs/plans/STATUS.md`) is no longer present in this repo, and the original packet files now live under [`docs/plans/old/`](/home/luke/Desktop/learning/homeschool-v2/docs/plans/old).

For current sequencing, use the deployment or activation roadmaps instead of replaying these as a live task board.

## Before Delegating

If this directory is not already a Git repo, initialize it once before using any branch workflow:

```bash
git init
git branch -m main
```

## Historical Ground Rules

- Give exactly one worker ownership of each plan file.
- Historical note: these workflows originally used `docs/plans/STATUS.md` on `main`, but that coordination file is no longer in the repo.
- Stay inside the owned write scope listed in that plan.
- Do not edit `package.json`, lockfiles, root config files, or shared layouts unless your plan explicitly owns them.
- If another task is not merged yet, use mock data or a local adapter inside your owned scope rather than editing another worker's files.
- Treat [docs/PRODUCT_IMPLEMENTATION_PLAN.md](/home/luke/Desktop/learning/homeschool-v2/docs/PRODUCT_IMPLEMENTATION_PLAN.md) as the product source of truth.
- Keep feature work modular so final integration is mostly wiring, not rewriting.
- When you merge a branch back to `main`, rerun the relevant checks and include `bash ./scripts/verify-before-merge.sh` for UI-facing changes.

## Suggested Parallel Batch

Archived packet files:

- [01-platform-and-local-dev.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/old/01-platform-and-local-dev.md)
- [02-data-model-and-repositories.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/old/02-data-model-and-repositories.md)
- [03-parent-workspace-shell.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/old/03-parent-workspace-shell.md)
- [04-curriculum-and-standards.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/old/04-curriculum-and-standards.md)
- [05-planning-and-daily-workspace.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/old/05-planning-and-daily-workspace.md)
- [06-learner-activity-engine.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/old/06-learner-activity-engine.md)
- [07-tracking-and-reporting.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/old/07-tracking-and-reporting.md)
- [08-ai-platform-and-copilot.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/old/08-ai-platform-and-copilot.md)

Suggested merge order:

1. `01-platform-and-local-dev`
2. `02-data-model-and-repositories`
3. `03-parent-workspace-shell`
4. `04` through `08` in any order
5. Final stabilization and integration pass after all branches are merged

## Status Board

The original `STATUS.md` coordination board is gone.

If you are reading these archived packets for historical context, treat the old status references as retired workflow instructions rather than active repo files.

## Ownership Map

- `01` owns local platform setup, env/config, Supabase local workflow, root developer tooling, and platform boundaries.
- `02` owns Drizzle schema, migrations, and repository/data-access code.
- `03` owns the shared parent workspace shell and navigation.
- `04` owns curriculum and standards feature work.
- `05` owns planning views, daily workspace, and scheduling logic.
- `06` owns the learner surface and interactive activity runtime.
- `07` owns tracking, reporting, and progress views.
- `08` owns AI task routing, copilot UX, and async generation plumbing.

## Integration Note

The intentional tradeoff here is that some feature tasks may temporarily use mock adapters or placeholder service contracts. That is expected. The goal of the split is parallel velocity with low conflict risk, not perfect first-pass integration.

## Cross-Cutting Roadmaps

These are higher-level sequencing documents that cut across the original parallel work packets:

- [path_to_deployment/deployment-studio-roadmap.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/deployment-studio-roadmap.md)
- [path_to_deployment/studio-mode-implementation-checklist.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/studio-mode-implementation-checklist.md)
