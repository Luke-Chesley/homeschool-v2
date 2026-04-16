# Local And Hosted QA Pipeline

Use this pipeline when you want one or more agents to exercise the app locally or on the hosted stage deployment and report back on real runtime behavior.

This is for:
- route and flow verification
- responsive review
- auth and setup validation
- regression checks before merge or before a staging push

This is not for:
- code review without execution
- hosted-only infrastructure checks
- implementation work

## Goal

Turn QA into a repeatable local process with:
- a stable route inventory
- stable local personas and seeded states
- dedicated prompts per workflow area
- explicit execution logs
- clear signoff language

## Environment Map

Use one environment intentionally:

- `local`
  `http://localhost:3000` with local Supabase data. Use `/home/luke/Desktop/learning/codex-agent-loop-harness/LOCAL_TEST_USERS.md`.
- `preview` / `stage`
  The latest Vercel preview deployment or the stable `stage` branch alias. This environment maps to the hosted stage Supabase project. Use `/home/luke/Desktop/learning/codex-agent-loop-harness/PREVIEW_TEST_USERS.md`.
- `production`
  The `main` branch deployment and hosted production Supabase project. Only run production QA when the task explicitly asks for it. Do not use preview accounts on production.

Current hosted aliases:
- `stage`: `homeschool-v2-git-stage-lukechesleyfive-2290s-projects.vercel.app`
- `production`: `homeschool-v2.vercel.app` and `homeschool-v2-git-main-lukechesleyfive-2290s-projects.vercel.app`

## Default Environment

Repo:
- `/home/luke/Desktop/learning/homeschool-v2`

Default app target:
- `http://localhost:3000` for local runs
- the latest Vercel preview deployment URL for stage/preview runs

If `localhost:3000` is not already running, start it from the main checkout:

```bash
corepack pnpm dev
```

## Default Viewports

Unless a prompt says otherwise, agents should test:

- laptop: `1440x900`
- tablet: `1024x768` or `820x1180`
- phone: `390x844` or `393x852`

## How To Use This Pipeline

1. Pick the QA prompts that match the flows you changed.
2. Give the agent the prompt file or paste the prompt content directly.
3. Choose the environment before the browser run:
   - local -> `localhost:3000`
   - preview/stage -> latest Vercel preview deployment
   - production -> only when explicitly requested
4. Choose the right account source:
   - local -> `/home/luke/Desktop/learning/codex-agent-loop-harness/LOCAL_TEST_USERS.md`
   - preview/stage -> `/home/luke/Desktop/learning/codex-agent-loop-harness/PREVIEW_TEST_USERS.md`
   - production -> dedicated production-safe credentials only
5. For downstream stage QA on `Today`, `Tracking`, planning, or lesson-flow work, prefer `stage_single_parent_seed` from `PREVIEW_TEST_USERS.md` unless the scenario specifically needs a fresh account or a heavier existing household.
6. Require a report with:
   - findings
   - execution log
   - environment checked
   - target deployment URL
   - account used
   - route coverage completed
   - residual risks
   - signoff recommendation

## Prompt Set

Core prompts:
- [Auth And Onboarding QA](/home/luke/Desktop/learning/homeschool-v2/docs/qa/prompts/auth-onboarding-agent-prompt.md)
- [Parent Workspace QA](/home/luke/Desktop/learning/homeschool-v2/docs/qa/prompts/parent-workspace-agent-prompt.md)
- [Curriculum And Planning QA](/home/luke/Desktop/learning/homeschool-v2/docs/qa/prompts/curriculum-planning-agent-prompt.md)
- [Learner Flow Responsive QA](/home/luke/Desktop/learning/homeschool-v2/docs/qa/prompts/learner-flow-agent-prompt.md)
- [Tracking And Account QA](/home/luke/Desktop/learning/homeschool-v2/docs/qa/prompts/tracking-account-agent-prompt.md)
- [Copilot QA](/home/luke/Desktop/learning/homeschool-v2/docs/qa/prompts/copilot-agent-prompt.md)
- [Full Product Smoke QA](/home/luke/Desktop/learning/homeschool-v2/docs/qa/prompts/full-product-smoke-agent-prompt.md)

Reference docs:
- [QA Flow Inventory](/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-flow-inventory.md)
- [QA Report Template](/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-report-template.md)
- [Persona Test Matrix](/home/luke/Desktop/learning/homeschool-v2/docs/qa/persona-test-matrix.md)
- [Subagent Activation Prompts](/home/luke/Desktop/learning/homeschool-v2/docs/qa/subagent-activation-prompts.md)

## Subagent Pattern

Recommended local QA pattern:

1. `data_setup_runner`
   - prepares realistic local states
2. `persona_qa_runner`
   - tests whether the app makes sense for a specific user type
3. `qa_runner`
   - executes route-and-flow QA with responsive coverage
4. `launch_smoke_runner`
   - returns a strict release-style pass/fail recommendation

Use this pattern when you want QA that is both product-aware and operationally repeatable.

## Suggested Usage By Situation

When changing auth or signup:
- run `Auth And Onboarding QA`

When changing `Today`, planning, or curriculum:
- run `Parent Workspace QA`
- run `Curriculum And Planning QA`

When changing learner routes or activity runtime:
- run `Learner Flow Responsive QA`

When changing records, account settings, or household management:
- run `Tracking And Account QA`

When changing AI integrations or Copilot UI:
- run `Copilot QA`

Before merge to `main` or before a staging push:
- run `Full Product Smoke QA`

## Operator Notes

- Agents should treat these as execution instructions, not documents to critique.
- Agents should not stop at route discovery or code inspection.
- Agents should use the `playwright` skill for real browser execution in Codex.
- Agents should use the Vercel tool first for preview/stage runs and record the exact deployment URL in the report.
- Agents should capture screenshots for visible failures, broken components, and suspicious runtime states.
- Agents should reuse seeded local accounts when appropriate, still create fresh fake accounts for true first-run and sign-up checks, and never carry preview credentials into production checks.
- Agents should use the report template structure so results stay comparable across runs.
