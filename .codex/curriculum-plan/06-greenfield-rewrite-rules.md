# Greenfield Rewrite Rules

This app is early enough that the curriculum-routing work should optimize for the right canonical design, not backward compatibility with provisional shapes.

## Core Rule

If an older abstraction conflicts with the cleaner routing model, prefer the cleaner routing model.

## Guidance

- `curriculum_nodes` should become the canonical curriculum hierarchy for guided routing.
- `PlanItem` should remain the canonical daily execution object unless a clearly stronger design beats it.
- Weekly routing should have its own persistent model.
- Do not preserve legacy naming or tables just because they already exist.
- Prefer one canonical source of truth per concept.

## Canonical Ownership

- canonical curriculum hierarchy: `curriculum_nodes`
- canonical learner progress summary: `learner_skill_states`
- canonical weekly planning object: `weekly_route_items`
- canonical daily execution object: `PlanItem`

## Agent Rule

Agents may replace or de-emphasize older provisional structures when they conflict with the routing model, but they should document contract changes in `STATUS.md`.

## Bottom Line

This is a greenfield optimization problem, not a legacy-preservation problem.
