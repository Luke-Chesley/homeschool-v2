# Parallel Work Plans

These files split the master implementation plan into parallel work packets with clear ownership boundaries so multiple AI tools can work at the same time with less merge pain.

## Before Delegating

If this directory is not already a Git repo, initialize it once before using any branch workflow:

```bash
git init
git branch -m main
```

## Ground Rules

- Give exactly one worker ownership of each plan file.
- Check [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md) on `main` before starting work.
- Claim a task by updating [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md) on `main` before creating your feature branch.
- Stay inside the owned write scope listed in that plan.
- Do not edit `package.json`, lockfiles, root config files, or shared layouts unless your plan explicitly owns them.
- If another task is not merged yet, use mock data or a local adapter inside your owned scope rather than editing another worker's files.
- Treat [docs/PRODUCT_IMPLEMENTATION_PLAN.md](/home/luke/Desktop/homeschoolV2/docs/PRODUCT_IMPLEMENTATION_PLAN.md) as the product source of truth.
- Keep feature work modular so final integration is mostly wiring, not rewriting.

## Suggested Parallel Batch

These can all start immediately:

- [01-platform-and-local-dev.md](/home/luke/Desktop/homeschoolV2/docs/plans/01-platform-and-local-dev.md)
- [02-data-model-and-repositories.md](/home/luke/Desktop/homeschoolV2/docs/plans/02-data-model-and-repositories.md)
- [03-parent-workspace-shell.md](/home/luke/Desktop/homeschoolV2/docs/plans/03-parent-workspace-shell.md)
- [04-curriculum-and-standards.md](/home/luke/Desktop/homeschoolV2/docs/plans/04-curriculum-and-standards.md)
- [05-planning-and-daily-workspace.md](/home/luke/Desktop/homeschoolV2/docs/plans/05-planning-and-daily-workspace.md)
- [06-learner-activity-engine.md](/home/luke/Desktop/homeschoolV2/docs/plans/06-learner-activity-engine.md)
- [07-tracking-and-reporting.md](/home/luke/Desktop/homeschoolV2/docs/plans/07-tracking-and-reporting.md)
- [08-ai-platform-and-copilot.md](/home/luke/Desktop/homeschoolV2/docs/plans/08-ai-platform-and-copilot.md)

Suggested merge order:

1. `01-platform-and-local-dev`
2. `02-data-model-and-repositories`
3. `03-parent-workspace-shell`
4. `04` through `08` in any order
5. Final stabilization and integration pass after all branches are merged

## Status Board

Use [STATUS.md](/home/luke/Desktop/homeschoolV2/docs/plans/STATUS.md) as the coordination source of truth.

- `not_started`: no one owns it right now
- `in_progress`: currently claimed on `main`
- `blocked`: someone started it but is waiting on something
- `done`: merged back to `main`

Every worker should:

1. Check `STATUS.md` on `main`
2. Claim one available task in `STATUS.md`
3. Create a branch and implement the task
4. Merge back to `main`
5. Mark the task `done` in `STATUS.md`

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
