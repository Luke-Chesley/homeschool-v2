# Curriculum Plan Status Dashboard

Update this file in every agent PR.

Keep it boring and current.

## Contract Freeze Status

- [x] Shared persistence contract accepted
- [x] Stable route-generation contract accepted
- [ ] Daily `PlanItem` integration contract accepted
- [ ] Tracking/feedback contract accepted

## Agent Status

### Agent A — Import Normalization

- Scope: normalized curriculum import, hierarchy preservation, persisted route nodes
- Branch: `agent-a/curriculum-import-normalization`
- Depends on: shared persistence contract
- Can start before full merge: yes
- Status: complete
- Blockers: none for code; local browser validation still needs a migrated dev database before `/api/curriculum/sources` can run against the updated schema
- PR: pending
- Acceptance criteria complete:
  - [x] normalization rules implemented
  - [x] normalized nodes persisted
  - [x] source detail tree backed by normalized nodes
  - [x] re-import behavior defined and tested

### Agent B — Weekly Route

- Scope: deterministic recommendations, weekly queue, reorder persistence, conflicts, repair preview
- Branch: `agent-b/weekly-route-board`
- Depends on: shared persistence contract, learner-skill-state contract
- Can start before full merge: yes, against fixtures or repository adapters
- Status: complete
- Blockers: none
- PR: pending
- Acceptance criteria complete:
  - [x] route generation deterministic
  - [x] weekly route persisted
  - [x] reorder stored as override without mutating canonical sequence
  - [x] conflicts and repair preview implemented

### Agent C — Daily Selection And Deferral

- Scope: assign weekly route items to a day, create `PlanItem`s, push to next day, today view quick actions
- Branch: `agent-c/daily-selection-deferral`
- Depends on: shared persistence contract, weekly-route-item contract, `PlanItem` curriculum metadata contract
- Can start before full merge: yes, after contract freeze
- Status: not started
- Blockers: daily integration contract
- PR: pending
- Acceptance criteria complete:
  - [ ] selecting route items creates linked `PlanItem`s
  - [ ] push-to-next-day preserves context
  - [ ] today view can complete, defer, and swap
  - [ ] duplicate scheduling rules enforced

### Agent D — Tracking And Feedback

- Scope: completion/mastery backflow, route adaptation, review/reteach suggestions, outcome persistence
- Branch: `agent-d/tracking-feedback-loop`
- Depends on: shared persistence contract, daily execution contract, learner-skill-state contract
- Can start before full merge: yes, after contract freeze
- Status: not started
- Blockers: stable outcome event contract
- PR: pending
- Acceptance criteria complete:
  - [ ] completion updates learner skill state
  - [ ] mastery outcomes affect recommendations
  - [ ] unfinished work preferred before new work
  - [ ] review/reteach flags generated deterministically

## Cross-Agent Integration Checklist

- [x] Stable curriculum node IDs available to all layers
- [ ] Stable learner-skill-state IDs and statuses available to all layers
- [x] Weekly route items reference canonical curriculum nodes
- [ ] Daily `PlanItem`s reference weekly route items and curriculum nodes
- [ ] Completion events can update both planning state and learner skill state
- [ ] Conflicts are computed consistently across weekly and daily surfaces

## Open Contract Changes

Add items here before changing a shared contract:

- Agent A: `curriculum_sources` now carries `status` and `import_version` directly instead of hiding import lifecycle only in metadata.
- Agent A: `curriculum_nodes` now carries `is_active` so re-import can retire unmatched nodes without deleting historical identity.

## Merge Order

- [x] Shared contract PR merged
- [x] Agent A merged
- [ ] Agent B merged
- [ ] Agent C merged
- [ ] Agent D merged

## Notes

Use this section for short cross-agent coordination notes only.

- Agent A contract summary: a curriculum node is one persisted row in `curriculum_nodes`; `id` is deterministic from `(source lineage id, normalized_type, normalized_path)`; parent-child structure is `parent_node_id`; canonical sibling order is `sequence_index`; cross-version retirements flip `is_active` to false rather than deleting the node row.
- Agent A implemented source-detail reads from persisted normalized nodes. Weekly and daily routing should not read `curriculum_items` for canonical sequence.
- Agent B contract summary:
  - `weekly_route_items` are the canonical per-week planning rows; one row references one canonical `curriculum_nodes.id` skill via `skill_node_id`.
  - Deterministic generation now persists `weekly_routes` + ordered `weekly_route_items` using `recommended_position` and `current_position`; canonical curriculum sequence is never mutated.
  - Reorder overrides persist only in weekly route state (`current_position`, `manual_override_kind`, `manual_override_note`) and audit to `route_override_events`.
  - Conflict payload shape is `{ type, affectedItemIds, blockingSkillNodeIds, explanation, suggestedRepairActions, keepOverrideAllowed }`.
  - Daily handoff fields from each weekly route item are `{ weeklyRouteItemId, curriculumSourceId, curriculumSkillNodeId, currentPosition, scheduledDate, state }`.
