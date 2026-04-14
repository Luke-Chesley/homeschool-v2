# Local QA Pipeline

Use this pipeline when you want one or more agents to exercise the app locally at `http://localhost:3000` and report back on real runtime behavior.

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

## Default Environment

Repo:
- `/home/luke/Desktop/homeschool-v2`

Default app target:
- `http://localhost:3000`

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
3. Provide current credentials separately if needed.
4. Require a report with:
   - findings
   - execution log
   - route coverage completed
   - residual risks
   - signoff recommendation

## Prompt Set

Core prompts:
- [Auth And Onboarding QA](/home/luke/Desktop/homeschool-v2/docs/qa/prompts/auth-onboarding-agent-prompt.md)
- [Parent Workspace QA](/home/luke/Desktop/homeschool-v2/docs/qa/prompts/parent-workspace-agent-prompt.md)
- [Curriculum And Planning QA](/home/luke/Desktop/homeschool-v2/docs/qa/prompts/curriculum-planning-agent-prompt.md)
- [Learner Flow Responsive QA](/home/luke/Desktop/homeschool-v2/docs/qa/prompts/learner-flow-agent-prompt.md)
- [Tracking And Account QA](/home/luke/Desktop/homeschool-v2/docs/qa/prompts/tracking-account-agent-prompt.md)
- [Copilot QA](/home/luke/Desktop/homeschool-v2/docs/qa/prompts/copilot-agent-prompt.md)
- [Full Product Smoke QA](/home/luke/Desktop/homeschool-v2/docs/qa/prompts/full-product-smoke-agent-prompt.md)

Reference docs:
- [QA Flow Inventory](/home/luke/Desktop/homeschool-v2/docs/qa/qa-flow-inventory.md)
- [QA Report Template](/home/luke/Desktop/homeschool-v2/docs/qa/qa-report-template.md)
- [Persona Test Matrix](/home/luke/Desktop/homeschool-v2/docs/qa/persona-test-matrix.md)
- [Subagent Activation Prompts](/home/luke/Desktop/homeschool-v2/docs/qa/subagent-activation-prompts.md)

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
- Agents should use the report template structure so results stay comparable across runs.
