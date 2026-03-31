# Curriculum Plan Status Dashboard

Update this file in every agent PR.

Keep it boring and current.

## Contract Freeze Status

- [x] Shared persistence contract accepted
- [ ] Stable route-generation contract accepted
- [ ] Daily `PlanItem` integration contract accepted
- [x] Tracking/feedback contract accepted

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
- Status: not started
- Blockers: shared contract freeze
- PR: pending
- Acceptance criteria complete:
  - [ ] route generation deterministic
  - [ ] weekly route persisted
  - [ ] reorder stored as override without mutating canonical sequence
  - [ ] conflicts and repair preview implemented

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
- Status: complete
- Blockers: no blocking code issues; full end-to-end validation depends on curriculum-linked `PlanItem` rows created by Agent C flows
- PR: pending
- Acceptance criteria complete:
  - [x] completion updates learner skill state
  - [x] mastery outcomes affect recommendations
  - [x] unfinished work preferred before new work
  - [x] review/reteach flags generated deterministically

## Cross-Agent Integration Checklist

- [x] Stable curriculum node IDs available to all layers
- [x] Stable learner-skill-state IDs and statuses available to all layers
- [ ] Weekly route items reference canonical curriculum nodes
- [ ] Daily `PlanItem`s reference weekly route items and curriculum nodes
- [x] Completion events can update both planning state and learner skill state
- [ ] Conflicts are computed consistently across weekly and daily surfaces

## Open Contract Changes

Add items here before changing a shared contract:

- Agent A: `curriculum_sources` now carries `status` and `import_version` directly instead of hiding import lifecycle only in metadata.
- Agent A: `curriculum_nodes` now carries `is_active` so re-import can retire unmatched nodes without deleting historical identity.
- Agent D: no schema expansion; downstream recommendation logic should treat `learner_skill_states.status`, `status_reason`, and `last_outcome_summary` as the canonical progress-feedback contract for routing.

## Merge Order

- [ ] Shared contract PR merged
- [ ] Agent A merged
- [ ] Agent B merged
- [ ] Agent C merged
- [ ] Agent D merged

## Notes

Use this section for short cross-agent coordination notes only.

- Agent A contract summary: a curriculum node is one persisted row in `curriculum_nodes`; `id` is deterministic from `(source lineage id, normalized_type, normalized_path)`; parent-child structure is `parent_node_id`; canonical sibling order is `sequence_index`; cross-version retirements flip `is_active` to false rather than deleting the node row.
- Agent A implemented source-detail reads from persisted normalized nodes. Weekly and daily routing should not read `curriculum_items` for canonical sequence.
- Agent D contract summary:
  - Outcome-to-skill linkage is resolved from `interactive_activities.plan_item_id -> plan_item_curriculum_links` and persisted for audit in `progress_records.metadata.curriculumLink`.
  - `learner_skill_states` is the canonical curriculum progress summary; completion sets `completed_at`, mastery sets `mastered_at`, and weak/proficient completion routes to `status = recommended` with deterministic `status_reason` values.
  - Deterministic recommendation priority is: unfinished scheduled (`scheduled`, `in_progress`) before out-of-sequence repair, before reteach recommendations, before review recommendations.
