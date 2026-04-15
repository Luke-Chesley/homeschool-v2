# Starter Prompts

## Scenario Factory prompt

You are generating 5 high-value homeschool scenario cards for activation and learning-core testing.

Read:
- docs/agent-loops/README.md
- docs/agent-loops/operating-model.md
- docs/agent-loops/scenario-matrix.md
- docs/agent-loops/starter-scenarios.md

Goals:
- cover at least 3 different source types
- include at least 1 messy / adversarial input
- include at least 1 scenario likely to expose a new activity-pack need
- make the scenarios realistic, with parent wording

For each scenario include:
- scenario_id
- parent request
- learner details
- source shape
- expected horizon
- expected wow moment
- likely primary risk
- likely pack opportunity

Do not run the app. Just produce reusable scenario cards.

## Execution Runner prompt

Take scenario ids S00X, S00Y, and S00Z.

Read:
- docs/agent-loops/runbook.md
- docs/agent-loops/report-template.md
- docs/agent-loops/triage-taxonomy.md

Tasks:
1. Run the scenarios through the local app when the question is activation or Today readiness.
2. Use direct learning-core operation calls when needed to isolate the failure.
3. Save a structured run report for each scenario.

Be exact about:
- what input was used
- what route or operation was used
- what generated successfully
- what failed
- who owns the main failure

Do not change code.

## Evaluator prompt

Review the latest execution reports and generated outputs.

Read:
- docs/agent-loops/evaluation-rubric.md
- docs/agent-loops/report-template.md
- docs/agent-loops/triage-taxonomy.md

For each run:
- score every rubric category
- state whether the output is beta-worthy
- name the main success
- name the main failure
- assign a primary owner
- say whether the scenario produced a real wow moment

Do not redesign the product.
Do not change code.

## Pack Gap Miner prompt

Review the last 8–10 scored run reports.

Read:
- docs/agent-loops/triage-taxonomy.md
- ../../learning-core/docs/agent-feedback/pack-gap-taxonomy.md

Find repeated clusters where:
- current activity generation is generic
- the wrong interaction pattern is chosen
- a reusable pack should exist

For each cluster, write:
- cluster name
- scenario ids
- repeated failure pattern
- whether this is a new pack, pack-detection issue, or upstream lesson issue
- the smallest validation set to prove the improvement

## Backlog Synthesizer prompt

Read the latest scenario cards, run reports, evaluation reports, and pack-gap notes.

Produce:
- top 3 homeschool-v2 issues
- top 3 learning-core issues
- top 2 pack opportunities
- top 3 untested scenario families
- recommended next 3 codex runs

Keep each item evidence-based and cite scenario ids.
