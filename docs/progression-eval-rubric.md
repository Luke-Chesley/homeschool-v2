# Progression Evaluation Rubric

Use this rubric with the deterministic fixture harness in [curriculum-progression-eval.mts](/home/luke/Desktop/learning/homeschool-v2/scripts/curriculum-progression-eval.mts) and the fixture pack in `homeschool-v2/scripts/fixtures/progression/`.

## What this pass evaluates

This pass is not an LLM-as-judge system.

It is meant to provide:
- deterministic invariant checks against authoritative canonical skill refs
- reusable progression-basis fixtures across several curriculum shapes
- a lightweight human review rubric for pedagogical quality beyond the invariants

## Deterministic checks

A candidate progression should fail automatically if it has any of these:
- missing skill refs
- duplicate skill refs across phases
- invented skill refs
- blank or missing phase descriptions
- empty phases
- hard prerequisite self-loops
- hard prerequisite cycles
- backward `hardPrerequisite` edges
- backward `recommendedBefore` edges
- unresolved canonical skillRef to nodeId mappings

Warnings should be reviewed for:
- phase count outside suggested budget range
- large phase size imbalance
- excessive unit fragmentation
- very dense edge graphs

## Human review dimensions

Score each dimension from `1` to `4`.

| Dimension | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| Canonical coverage / integrity | Missing, duplicated, or invented refs | Technically valid but sloppy coverage or weak descriptions | Fully valid with minor rough edges | Fully valid, clean, and easy to trust downstream |
| Prerequisite soundness | Dependencies are wrong or unsafe | Some gating logic is questionable | Dependencies are mostly sound | Dependencies are crisp, sparse, and instructionally justified |
| Source-order fidelity | Ignores authored order without reason | Frequent unnecessary reordering | Mostly respects authored order | Respects authored order strongly and only departs for clear pedagogical reasons |
| Phase coherence | Phases feel arbitrary or catch-all | Several phases are awkwardly grouped | Phases are mostly coherent and teachable | Phases have clear purpose, support level, and grouping logic |
| Schedulability | Phases are too tiny or too large | Budget fit is uneven | Phases are generally teachable within the pacing | Phase granularity fits pacing and likely instructional cadence well |
| Review / retrieval support | No deliberate revisit strategy | Revisit edges exist but feel random | Some purposeful revisit support | Review and retrieval are deliberate, timely, and useful |
| Support fade / independence ramp | Guidance level is flat or regresses | Some ramp but inconsistent | Clear movement toward independence | Strong novice-safe opening with deliberate fade toward integration/application |
| Overall downstream usefulness | Hard to route or schedule from | Usable with manual cleanup | Mostly ready for scheduling | Strong input for launch planning and day/session scheduling |

## Fixture set

The current fixture pack covers:
- safety-heavy early-childhood practical-life / cooking
- concept-first elementary math
- task-first project-based science
- mixed literacy unit
- long multi-unit social studies source
- one weakly structured source import

Each fixture stores:
- a progression basis input
- one good example progression
- several intentionally bad progressions

## Suggested workflow

1. Run the deterministic fixture harness.
2. Confirm all good fixtures pass and all bad fixtures fail.
3. Sample at least one good fixture per delivery pattern for human review.
4. Review warning-heavy outputs even when they pass deterministic checks.
5. When prompt or validation logic changes, update the fixtures instead of letting the expected behavior drift implicitly.
