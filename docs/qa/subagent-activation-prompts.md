# Subagent Activation Prompts

Paste these prompts to activate the QA subagents and run repeatable local QA passes.

## 1. Prepare Realistic Local QA Data

Use when the local app is too empty for meaningful QA.

```text
Use data_setup_runner to prepare realistic local QA states for homeschool-v2 on http://localhost:3000. Follow docs/qa/local-qa-pipeline.md and docs/qa/persona-test-matrix.md. Prepare, at minimum, a single_learner_parent state and an active_learner state, and if practical also prepare fresh_parent, sparse_parent, and multi_learner_parent states. Do not change product code. Return a setup summary with exactly what was created, which personas are ready, any credentials or identifiers needed for QA, and any blocked setup steps.
```

## 2. Full Product Smoke QA

Use for a broad local smoke pass before merge or before handing off for review.

```text
Use qa_runner to execute a full local QA pass for homeschool-v2 on http://localhost:3000. Follow docs/qa/local-qa-pipeline.md, docs/qa/qa-report-template.md, and docs/qa/prompts/full-product-smoke-agent-prompt.md. Do live browser QA, not code review, and return findings, responsive results, execution log, flow coverage, residual risks, and a signoff recommendation.
```

## 3. Persona-Based Fresh Parent Review

Use when you want to know whether the first-run product story is guided enough.

```text
Use persona_qa_runner to review homeschool-v2 as the fresh_parent persona on http://localhost:3000. Follow docs/qa/local-qa-pipeline.md, docs/qa/persona-test-matrix.md, and docs/qa/qa-report-template.md. Focus on landing page, sign-up, auth/setup, onboarding, and the first-run path into Today. This is a live browser QA run, not code review. Return findings, responsive results, execution log, flow coverage, residual risks, and a persona-specific conclusion about whether the app feels guided enough for a first-time parent.
```

## 4. Persona-Based Single Learner Review

Use when you want the most representative day-to-day parent workflow check.

```text
Use persona_qa_runner to review homeschool-v2 as the single_learner_parent persona on http://localhost:3000. Follow docs/qa/local-qa-pipeline.md, docs/qa/persona-test-matrix.md, and docs/qa/qa-report-template.md. Focus on Today, curriculum, planning, learner handoff, and one real learner activity. This is live browser QA, not code review. Return findings, responsive results, execution log, flow coverage, residual risks, and a persona-specific conclusion about whether the product feels directed and workable for a parent managing one learner.
```

## 5. Persona-Based Multi Learner Review

Use when testing complexity, switching, and information density.

```text
Use persona_qa_runner to review homeschool-v2 as the multi_learner_parent persona on http://localhost:3000. Follow docs/qa/local-qa-pipeline.md, docs/qa/persona-test-matrix.md, and docs/qa/qa-report-template.md. Focus on Today, learner switching, users, tracking, and whether the workspace remains calm with multiple learners. Return findings, responsive results, execution log, flow coverage, residual risks, and a persona-specific conclusion.
```

## 6. Learner Responsive Review

Use when checking the actual learner experience deeply.

```text
Use qa_runner to execute a learner-flow QA pass for homeschool-v2 on http://localhost:3000. Follow docs/qa/local-qa-pipeline.md, docs/qa/qa-report-template.md, and docs/qa/prompts/learner-flow-agent-prompt.md. Exercise Today to learner handoff, /learner, and one real /activity/[sessionId] at laptop, tablet, and phone widths. Compare studio mode off and on. Return findings, responsive results, execution log, flow coverage, residual risks, and signoff recommendation.
```

## 7. Auth And Onboarding Review

Use when signup, login, confirmation, or setup changed.

```text
Use qa_runner to execute an auth and onboarding QA pass for homeschool-v2 on http://localhost:3000. Follow docs/qa/local-qa-pipeline.md, docs/qa/qa-report-template.md, and docs/qa/prompts/auth-onboarding-agent-prompt.md. Do live browser QA, not code review. Return findings, responsive results, execution log, flow coverage, residual risks, and signoff recommendation.
```

## 8. Tracking And Account Review

Use when records, household settings, or learner management changed.

```text
Use qa_runner to execute a tracking and account QA pass for homeschool-v2 on http://localhost:3000. Follow docs/qa/local-qa-pipeline.md, docs/qa/qa-report-template.md, and docs/qa/prompts/tracking-account-agent-prompt.md. Return findings, responsive results, execution log, flow coverage, residual risks, and signoff recommendation.
```

## 9. Copilot Review

Use when Copilot UI or AI wiring changed.

```text
Use qa_runner to execute a Copilot QA pass for homeschool-v2 on http://localhost:3000. Follow docs/qa/local-qa-pipeline.md, docs/qa/qa-report-template.md, and docs/qa/prompts/copilot-agent-prompt.md. Return findings, execution log, flow coverage, residual risks, and signoff recommendation.
```

## 10. Strict Release-Gate Smoke

Use when you want a pass/fail recommendation, not a broad exploratory report.

```text
Use launch_smoke_runner to execute a strict local release smoke pass for homeschool-v2 on http://localhost:3000. Follow docs/qa/local-qa-pipeline.md, docs/qa/qa-flow-inventory.md, docs/qa/qa-report-template.md, and docs/qa/prompts/full-product-smoke-agent-prompt.md. Prioritize auth, Today, learner handoff, one live learner activity, curriculum, tracking, account, and Copilot. Return findings, execution log, flow coverage, residual risks, and a strict final recommendation: pass, pass with caveats, or fail.
```

## Recommended Best Pattern

For broad QA before a release or major merge:

1. Run `data_setup_runner`
2. Run `persona_qa_runner` for `single_learner_parent`
3. Run `qa_runner` for learner responsive QA
4. Run `launch_smoke_runner` for the final release-style check
