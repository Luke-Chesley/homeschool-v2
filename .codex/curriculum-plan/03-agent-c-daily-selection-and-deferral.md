# Agent C Plan — Daily Selection, `PlanItem` Integration, And Deferral

## Mission

Own the bridge from weekly curriculum route items into the existing daily planning and today execution surfaces.

## Scope

In scope:

- selecting weekly route items for a specific day
- persisting daily execution as `PlanItem`s with curriculum metadata
- push-to-next-day behavior
- swap-with-alternate behavior if supported by available route items
- today-view quick actions for curriculum-backed items

Out of scope:

- curriculum import and normalization
- weekly route generation rules
- mastery and feedback adaptation logic beyond emitting outcome hooks

## Required Inputs

This plan assumes stable contracts for:

- `weekly_route_item.id`
- `curriculum_skill_node_id`
- `curriculum_source_id`
- `PlanItem` curriculum metadata fields or an explicitly approved alternative

## Product Rules

- daily execution should use normal planning objects, not a parallel shadow system
- parents should choose from a guided queue, not rebuild the curriculum manually
- push-to-next-day is a normal operation
- curriculum context must survive defer and reschedule actions
- duplicate scheduling should be prevented unless the product explicitly allows review duplication

## Persistence Recommendation

Use `PlanItem` as the canonical persisted daily row.

Add or confirm fields like:

- `curriculum_source_id`
- `curriculum_skill_node_id`
- `weekly_route_item_id`
- `plan_origin`

If the current planning model cannot safely represent those fields, document the reason before introducing a dedicated daily route table.

## Flow Design

### Daily Selection

The parent should be able to choose from:

- recommended for today
- alternates from the same branch
- recovery items that were deferred earlier
- optional review items

Selection should create or update a `PlanItem`.

### Push To Next Day

This should:

- keep the curriculum linkage intact
- preserve relationship to the originating weekly route item
- update route-item or plan-item state so the weekly route stays coherent
- trigger conflict/capacity recomputation for the affected dates

### Today View Quick Actions

Minimum quick actions:

- mark complete
- push to tomorrow
- swap with alternate
- remove from today

## Acceptance Criteria

This plan is done when all of the following are true:

- selecting a weekly route item for a date creates a persisted daily execution object with curriculum metadata
- the same daily item can be loaded through the normal planning and today surfaces
- push-to-next-day preserves `curriculum_skill_node_id` and `weekly_route_item_id`
- deferring an item updates the affected day and does not orphan the weekly route item
- duplicate scheduling rules are enforced consistently
- today-view quick actions work for curriculum-backed items without a separate UI-only state system

## Test Cases

Minimum tests:

- selecting an item from weekly route creates a linked `PlanItem`
- loading the day plan shows the linked curriculum item correctly
- pushing the item to tomorrow keeps all curriculum references intact
- removing an item from today does not mutate canonical curriculum sequence
- if alternates are allowed, swapping preserves auditability of which item was actually scheduled

## Handoff To Other Agents

Agent C must make these stable for the rest of the system:

- `PlanItem` curriculum metadata contract
- push-to-next-day behavior semantics
- today-view action semantics for curriculum-backed work
- any event emitted when execution state changes

Update `STATUS.md` when those are contract-safe.
