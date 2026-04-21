# Beta Launch Scorecard

This scorecard is the current launch-confidence gate for the homeschool closed beta.

Use it with:

- [CURRENT_PRODUCT_AND_RUNTIME_MODEL](/home/luke/Desktop/learning/homeschool-v2/docs/CURRENT_PRODUCT_AND_RUNTIME_MODEL.md)
- [learning-core current model](/home/luke/Desktop/learning/learning-core/docs/CURRENT_PRODUCT_AND_RUNTIME_MODEL.md)
- [learning-core launch fixtures](/home/luke/Desktop/learning/learning-core/tests/fixtures/launch_eval/scenarios.json)

This document is about the current product and runtime model, not broader vision work.

## What must be true

- `source_interpret` classifies the source honestly and recommends a plausible opening horizon.
- `curriculum_generate` creates a durable curriculum when the source merits one, instead of collapsing everything into a shallow launch slice.
- opening-window and day-1 handoff produce a usable start without pretending the launch slice is the entire curriculum.
- `session_generate` and `activity_generate` stay bounded to the current lesson/day.
- Copilot answers stay grounded and only propose supported, bounded actions.
- Billing remains deferred and neutral in launch docs and operational guidance.

## Automated gates

Run these first.

### `learning-core`

```bash
cd /home/luke/Desktop/learning/learning-core
. .venv/bin/activate
pytest \
  tests/test_source_interpret.py \
  tests/test_curriculum_generate.py \
  tests/test_session_generate_lesson_shape.py \
  tests/test_copilot_contract.py \
  tests/test_launch_eval_fixtures.py -q
```

What this gate covers:

- source taxonomy and horizon contract integrity
- curriculum request-mode and prompt-shape integrity
- bounded day-lesson shape constraints
- Copilot action contract safety
- fixture coverage for the launch eval source classes

### `homeschool-v2`

```bash
cd /home/luke/Desktop/learning/homeschool-v2
corepack pnpm typecheck
node --import ./scripts/path-loader.mjs --test --experimental-strip-types \
  scripts/curriculum-source-interpret.test.mts \
  scripts/curriculum-learning-core-curriculum.test.mts \
  scripts/curriculum-launch-plan-resolution.test.mts \
  scripts/curriculum-progression-basis.test.mts \
  scripts/copilot-actions.test.mts
```

What this gate covers:

- app-side request/response contract alignment with `learning-core`
- source-entry fixture coverage across the main source classes
- launch opening-slice resolution
- progression basis integrity
- Copilot action schema and stream shape

## Manual or agent-scored scenarios

The canonical scenario set lives in:

- [learning-core/tests/fixtures/launch_eval/scenarios.json](/home/luke/Desktop/learning/learning-core/tests/fixtures/launch_eval/scenarios.json)

Required source classes:

- worksheet photo or screenshot
- chapter excerpt
- weekly plan
- outline or TOC
- large PDF or whole book
- topic seed
- shell-like request
- ambiguous or noisy source
- explicit range inside a large source
- cookbook or practical-skills source

For each scenario, score these dimensions:

- `source_interpret`
  - source kind correctness
  - entry strategy correctness
  - continuation mode plausibility
  - recommended horizon plausibility
  - assumption honesty
  - detected chunk grounding
- `curriculum_generate`
  - durable curriculum quality
  - scale relative to source
  - launch-plan quality
  - whether comprehensive sources stay comprehensive
  - whether bounded sources stay bounded
- launch/day-1 handoff
  - opening lesson count coherence
  - scope summary clarity
  - day-1 readiness
  - planning/progression opening the correct slice
- `session_generate` and `activity_generate`
  - lesson quality
  - activity usefulness
  - grounding to source and curriculum
  - age appropriateness
  - day-scope boundedness
- Copilot
  - answer quality
  - action grounding
  - action usefulness
  - action safety
  - supported-action alignment
  - false-positive action rate

## Thresholds

### Blockers

- any automated gate fails
- any scenario returns an unsupported Copilot action kind
- Copilot proposes a mutation that cannot be applied by the bounded app dispatcher
- a comprehensive source is flattened into a shallow week-only curriculum
- an ambiguous/noisy source is handled confidently without confirmation
- a day-lesson or activity output clearly overreaches the current lesson/day scope
- docs or scorecards still claim billing is launch-ready

### Warnings

- launch window is teachable but weakly worded
- assumptions are technically valid but too vague to inspire trust
- Copilot answers are useful but over-suggest actions
- practical-skills or homeschool-specific sources feel genericized
- session/activity outputs are safe but underpowered

## Ready Summary Format

Use this exact structure when reporting a pass:

```text
ready: yes|no
date:
environment:
automated_gates:
  learning_core:
  homeschool_v2:
manual_scenarios_reviewed:
blockers:
warnings:
notes:
```

## Initial Baseline For This Pass

As of `2026-04-20`, this launch-prep pass added:

- bounded Copilot action contract coverage
- source-class fixture coverage for the main intake shapes
- a fixture-backed launch eval scenario set
- a single scorecard with blocker vs warning thresholds

The automated gates should be rerun after any change to:

- source interpretation
- curriculum generation
- launch handoff
- day/session generation
- Copilot action types or dispatcher behavior
