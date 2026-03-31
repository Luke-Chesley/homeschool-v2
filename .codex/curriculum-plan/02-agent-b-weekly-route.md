# Agent B Plan — Weekly Route Generation, Conflicts, And Repair

## Mission

Own the deterministic planning layer that turns normalized curriculum plus learner state into an ordered weekly route.

## Scope

In scope:

- next-skill recommendation rules
- weekly route generation
- weekly route persistence
- reorder overrides
- conflict detection
- repair preview and repair apply flow
- weekly route UI contract

Out of scope:

- source import logic
- daily `PlanItem` creation
- outcome/mastery adaptation beyond consuming learner skill state

## Required Inputs

This plan assumes the shared contract exists for:

- normalized curriculum nodes
- learner branch activations
- learner skill states
- learner pacing settings

## Product Rules

- recommend deterministically, not heuristically
- prefer unfinished scheduled work before new work
- canonical curriculum sequence remains unchanged by weekly reorder
- manual reorder is allowed and visible
- conflicts are visible immediately
- repair must show a preview before applying

## Recommended Route Generation Algorithm

For each active branch:

1. gather leaf skills in canonical sequence
2. skip completed/mastered items
3. find the first eligible item not blocked by explicit prerequisites
4. place that item into the candidate set
5. continue round-robin or weighted fill until weekly capacity is reached

Tie-breaks should be deterministic.

Good default tie-break order:

1. unfinished scheduled item
2. lower sequence position within branch
3. higher branch priority if weighted
4. stable lexical fallback by ID

## Persistence Model Owned Here

Primary rows:

- `weekly_routes`
- `weekly_route_items`
- `route_override_events`

This plan should not change canonical curriculum rows.

## Conflict Model

Conflicts should usually be computed on read.

Minimum conflict types:

- predecessor not completed
- explicit prerequisite blocked
- item scheduled twice
- weekly capacity exceeded
- reorder moved skill ahead of unresolved predecessor

Each conflict should expose:

- machine-readable type
- affected item IDs
- human-readable explanation
- suggested repair actions
- whether keep-override is allowed

## Repair Model

Recommended v1 repair actions:

- move predecessor earlier
- move dependent item later
- acknowledge skip
- drop duplicate scheduling
- rebalance over-capacity items to next available slot

Repair should be a previewable diff.

## UI Contract

The weekly route surface needs these concepts, regardless of final component design:

- ordered route items
- each item's canonical position and current overridden position
- conflict badges
- rationale text or tags
- repair preview action
- workload summary

## Acceptance Criteria

This plan is done when all of the following are true:

- the same learner state and curriculum input always generate the same weekly route
- a weekly route can be persisted and reloaded without losing item order
- manual reorder updates `current_position` or equivalent override state without mutating canonical curriculum sequence
- conflict detection flags out-of-sequence and duplicate scheduling cases correctly
- repair preview can describe the resulting item order before it is applied
- route generation prefers unfinished scheduled work before introducing new skills
- weekly capacity uses learner pacing settings from the shared contract

## Test Cases

Minimum tests:

- deterministic generation from fixed fixture data
- multiple active branches round-robin correctly
- weighted branch priorities affect fill order deterministically
- reorder creates override state but leaves canonical node sequence untouched
- duplicate scheduled item creates a conflict
- repair preview resolves a simple predecessor conflict correctly

## Handoff To Other Agents

Agent B must make these stable for downstream consumers:

- `weekly_route.id`
- `weekly_route_item.id`
- weekly route item ordering semantics
- override event semantics for reorder and defer-related state
- conflict payload shape if shared with daily execution surfaces

Update `STATUS.md` when those are contract-safe.
