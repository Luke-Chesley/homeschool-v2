# Runbook

## Recommended session setup

### Session A — Scenario Factory
Goal: produce fresh scenario cards only.
Do not run the app.
Do not inspect the generated artifacts.
Stay focused on diversity and realism.

### Session B — Execution Runner
Goal: run scenarios through app and/or core.
Do not redesign the product.
Do not propose broad strategy changes.
Capture exact behavior.

### Session C — Evaluator
Goal: score outputs against the rubric.
Do not change code.
Do not hand-wave missing context.
Judge the output against the input and the product promise.

### Session D — Pack Gap Miner (optional)
Goal: review completed reports and identify reusable pack opportunities.
Do not file broad “AI should be smarter” findings.
Translate clusters into concrete pack needs and routing rules.

## Execution order per scenario

1. Read scenario card.
2. Identify intended route:
   - app onboarding
   - direct curriculum_intake
   - direct session_generate
   - direct activity_generate
3. Run the minimal flow needed.
4. Save:
   - scenario id
   - route used
   - exact inputs
   - exact outputs
   - screenshots if app-level
5. Score with evaluation rubric.
6. Route findings into backlog taxonomy.

## Use app-level flow when the question is

- Can the parent reach value quickly?
- Does the UI imply the right horizon?
- Does Today feel ready?
- Does activity loading state make sense?
- Do regenerate / add-context paths feel obvious?

## Use core-level flow when the question is

- Did intake interpret the source correctly?
- Was the lesson grounded in the source?
- Did session generation over-expand?
- Did activity generation choose the wrong shape?
- Is there a missing pack?

## Suggested throughput

Per day:
- 3 new scenario cards
- 2 fully executed runs
- 2 fully scored evaluations
- 1 synthesis pass

Do not optimize for volume yet.
Optimize for reusable insights.

## Stop conditions

Pause and escalate if:
- onboarding no longer reaches Today
- the same operation fails contract validation repeatedly
- scenario inputs are not preserved cleanly enough to reproduce
- the evaluator cannot tell whether the failure belongs to app or core
