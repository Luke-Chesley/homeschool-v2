# Curriculum Routing Schema Notes

## Greenfield Stance

This schema is intended to optimize for the right canonical curriculum-routing design.

It is not trying to preserve provisional table shapes if those shapes are weaker than the routing model.

## Canonical Ownership

The intended source of truth is:

- normalized curriculum hierarchy: `curriculum_nodes`
- explicit non-trivial prerequisites: `curriculum_skill_prerequisites`
- learner curriculum progress summary: `learner_skill_states`
- weekly planning state: `weekly_routes` and `weekly_route_items`
- weekly override audit trail: `route_override_events`
- daily execution: `plan_items` plus `plan_item_curriculum_links`

## What This Implies

- guided routing should not be forced through `curriculum_items` if normalized nodes are structurally better
- weekly route state should not be hidden inside generic planning rows
- daily execution should stay in the existing execution object unless there is a compelling reason to replace it entirely
- canonical curriculum sequence must remain separate from weekly and daily reordering

## Review Lens

Future implementation work should prefer:

- one canonical table per concept
- minimal duplicate state
- deterministic route generation over ambiguous heuristics
- explicit override persistence rather than mutating canonical sequence
