# Agentic Product Loop

This folder defines a local, agent-driven loop for:
- generating realistic homeschool scenarios
- running onboarding and Today flows
- evaluating curriculum, lesson, and activity outputs
- finding gaps in app UX, intake routing, and learning-core operations
- turning failures into concrete backlog items for `homeschool-v2` and `learning-core`

## Why this exists

The product now has two important properties:

1. `homeschool-v2` already has codex/QA runner patterns and a Today-first workflow.
2. `learning-core` already exposes named operations such as `curriculum_intake`, `curriculum_generate`, `session_generate`, `activity_generate`, and `session_evaluate`.

That means we can build a durable loop that separates:
- app activation problems
- intake/routing problems
- lesson-generation problems
- activity/pack coverage problems
- evaluation/reporting problems

## Recommended operating model

Run three concurrent codex sessions while you implement:

### 1. Scenario Factory
Creates fresh curriculum and household scenarios.
Output: scenario cards in `docs/agent-loops/scenarios/` or local scratch equivalents.

### 2. Execution Runner
Runs the scenario through:
- app onboarding + Today flow
- direct `learning-core` operations when useful

Output: execution reports with links to artifacts and failures.

### 3. Evaluator / Backlog Builder
Scores the generated outputs and translates findings into:
- `homeschool-v2` UX/intake issues
- `learning-core` operation changes
- new activity-pack opportunities

Output: scored report + issue briefs.

## Optional fourth session

### Pack Gap Miner
Clusters failures across many scenarios and proposes:
- new packs
- pack detection rules
- operation-routing changes
- prompt/contract adjustments

## Versioned vs local-only outputs

### Keep in git
- agent definitions in `.codex/agents/`
- rubrics, scenario schema, and runbooks in `docs/agent-loops/`
- stable starter scenario seeds

### Keep local / tmp
- raw run outputs
- screenshots
- copied generated JSON
- local credentials
- one-off debug dumps

## Success condition

A good loop does not just find random bugs. It should steadily answer:
- What kinds of parent input are weak?
- Which routes fail to reach a teachable day?
- Which learning-core operation is the wrong one for this input?
- Which activity pack should exist next?
- Which fixes belong in app code vs learning-core?
