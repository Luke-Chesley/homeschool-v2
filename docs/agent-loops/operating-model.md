# Operating Model

## Core idea

Do not make every agent do everything.

Use four bounded lanes:

1. **Scenario generation**
2. **Execution**
3. **Evaluation**
4. **Synthesis**

This matches the broader bounded-agent direction of the platform: small workers, explicit inputs/outputs, durable reports, and approved actions rather than one vague super-agent.

## Lane 1: Scenario generation

Purpose:
- create realistic and adversarial homeschool requests
- vary the source format
- vary the household shape
- vary the planning horizon implied by the source

Inputs:
- current product scope
- current activity packs
- recent failure patterns

Outputs:
- scenario card
- expected horizon
- expected “wow moment”
- likely failure hypotheses

## Lane 2: Execution

Purpose:
- run the scenario against the app and/or learning-core
- capture what was actually generated
- separate UX breakage from generation breakage

Two submodes:

### A. app-level execution
Use browser QA against:
- onboarding
- Today
- lesson loading
- activity loading
- learner switching
- regeneration paths

### B. core-level execution
Call learning-core operations directly to isolate:
- curriculum intake quality
- bounded plan generation quality
- session generation quality
- activity generation quality
- evaluation quality

Rule:
If the browser flow fails before output exists, log it as product activation failure.
If the browser flow works but the artifact is poor, log it as operation / prompt / contract failure.

## Lane 3: Evaluation

Purpose:
- score the generated output, not just whether it exists

Evaluate separately:
- input faithfulness
- planning horizon correctness
- lesson teachability
- activity usefulness
- parent clarity
- age appropriateness
- continuity into tomorrow
- pack fit / missing pack opportunity

## Lane 4: Synthesis

Purpose:
- convert noisy reports into a usable backlog

Each finding must be routed to exactly one primary owner:
- `homeschool-v2`
- `learning-core`
- `shared contract / routing`
- `new pack opportunity`
- `not a bug / expected limitation`

## Daily cadence

### Morning
- Scenario Factory produces 3–5 new scenario cards.
- Pick 1–2 expected-safe scenarios and 1 adversarial scenario.

### Midday
- Execution Runner runs the selected scenarios.
- Save artifacts, screenshots, and notes.

### Afternoon
- Evaluator scores outputs and files structured reports.

### End of day
- Backlog Synthesizer updates:
  - top product blockers
  - top learning-core blockers
  - top pack opportunities
  - which scenario families remain untested

## Guardrails

- Do not let agents edit prompts blindly after one bad run.
- Require at least 3 examples before declaring a pattern.
- Keep scenario cards small and explicit.
- Keep failure taxonomy stable so trends are visible over time.
- Favor surgical changes to operation routing, normalization, and pack coverage before major prompt rewrites.
