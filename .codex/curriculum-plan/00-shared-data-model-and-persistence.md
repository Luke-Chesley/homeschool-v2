# Shared Data Model And Persistence Plan

## Purpose

This file defines the canonical persistence contract for guided curriculum planning.

This is the one document that should be treated as the shared source of truth before the agent plans diverge.

## Design Principles

1. Use a relational model first.
2. Persist stable nouns, not every derived view.
3. Keep canonical curriculum sequence separate from planning overrides.
4. Persist daily execution in the existing planning model where possible.
5. Compute conflicts on read unless a human made an explicit durable decision.
6. Keep learner route state per learner.
7. Prefer sparse explicit dependency edges over a fully generic edge taxonomy.

## Canonical Persisted Entities

### 1. `curriculum_sources`

Represents an imported curriculum source.

Suggested fields:

- `id`
- `household_id`
- `title`
- `source_kind` — `json`, `pdf`, `manual`, `api`, `text`
- `import_version`
- `status` — `draft`, `active`, `archived`, `failed_import`
- `metadata_json`
- `created_at`
- `updated_at`

Notes:

- keep source-level metadata here
- do not overload this row with learner progress

### 2. `curriculum_nodes`

Represents the normalized curriculum hierarchy.

Suggested fields:

- `id`
- `source_id`
- `parent_id`
- `normalized_type` — `domain`, `strand`, `goal_group`, `skill`
- `title`
- `code`
- `description`
- `sequence_index`
- `depth`
- `path_text`
- `original_label`
- `original_type`
- `source_payload_json`
- `estimated_minutes`
- `created_at`
- `updated_at`

Notes:

- `sequence_index` is sibling order under the parent
- `path_text` can be denormalized for quick reads, but should be derivable
- `source_payload_json` should preserve imported nuance without infecting the core schema

### 3. `curriculum_skill_prerequisites`

Stores only explicit non-trivial prerequisite edges.

Suggested fields:

- `id`
- `source_id`
- `skill_node_id`
- `prerequisite_skill_node_id`
- `kind` — `explicit`, `inferred`
- `created_at`

Notes:

- do **not** store every next-sibling link here if normal sequence is already captured by `parent_id` plus `sequence_index`
- use this table only when the source or normalization layer discovers true prerequisite relationships beyond simple order

### 4. `learner_route_profiles`

Stores per-learner settings for curriculum route generation.

Suggested fields:

- `id`
- `learner_id`
- `source_id`
- `target_items_per_day`
- `target_minutes_per_day`
- `branch_weighting_json`
- `planning_days_json`
- `created_at`
- `updated_at`

Notes:

- this is the durable home for pacing settings
- it should not be conflated with daily plan rows

### 5. `learner_branch_activations`

Stores which curriculum branches are active for a learner.

Suggested fields:

- `id`
- `learner_id`
- `source_id`
- `node_id`
- `status` — `active`, `paused`, `completed`
- `started_at`
- `ended_at`
- `created_at`
- `updated_at`

Notes:

- usually this points at non-leaf nodes, but it can allow a leaf start point when the parent chooses `Start from here`

### 6. `learner_skill_states`

Stores the canonical per-learner state for leaf skills.

Suggested fields:

- `id`
- `learner_id`
- `source_id`
- `skill_node_id`
- `status` — `not_started`, `recommended`, `scheduled`, `in_progress`, `completed`, `mastered`, `blocked`, `paused`, `skipped`, `out_of_sequence`
- `status_reason`
- `first_scheduled_at`
- `last_scheduled_at`
- `completed_at`
- `mastered_at`
- `last_attempt_id`
- `last_outcome_summary_json`
- `created_at`
- `updated_at`

Notes:

- this is the most important operational table in the system
- weekly and daily planning should derive from this plus branch activations and pacing settings

### 7. `weekly_routes`

Represents a learner's generated weekly route for a given week.

Suggested fields:

- `id`
- `learner_id`
- `source_id`
- `week_start_date`
- `generation_version`
- `generation_basis_json`
- `status` — `draft`, `active`, `superseded`
- `created_at`
- `updated_at`

Notes:

- this is the container row for one generated weekly plan
- the `generation_basis_json` should capture enough context for audit/debug, not the full universe

### 8. `weekly_route_items`

Represents ordered weekly work items.

Suggested fields:

- `id`
- `weekly_route_id`
- `learner_id`
- `skill_node_id`
- `recommended_position`
- `current_position`
- `scheduled_date`
- `manual_override_kind` — `none`, `reordered`, `pinned`, `deferred`, `skipped_predecessor_acknowledged`
- `manual_override_note`
- `state` — `queued`, `scheduled`, `in_progress`, `done`, `removed`
- `created_at`
- `updated_at`

Notes:

- this is where planning overrides live
- canonical curriculum sequence must **not** change when this row changes

### 9. `route_override_events`

Stores durable manual actions that need an audit trail.

Suggested fields:

- `id`
- `learner_id`
- `weekly_route_item_id`
- `event_type` — `reorder`, `pin`, `defer`, `skip_acknowledged`, `repair_applied`
- `payload_json`
- `created_by_user_id`
- `created_at`

Notes:

- keep this event table small and meaningful
- do not store every read-time conflict here

### 10. Daily execution persistence

Recommendation:

Use existing `PlanItem` persistence as the canonical daily execution record.

Add curriculum-link fields rather than inventing a second daily-item table unless the current planning model makes that impossible.

Suggested additions to the planning layer:

- `curriculum_source_id`
- `curriculum_skill_node_id`
- `weekly_route_item_id`
- `plan_origin` — `manual`, `curriculum_route`, `recovery`, `review`

Why this is better:

- avoids dual daily representations
- lets the rest of the planning stack keep working
- makes today-view execution use the same persisted object as everything else

Only create a dedicated `daily_route_assignments` table if the existing planning model cannot safely represent these fields.

### 11. Outcome / tracking persistence

Recommendation:

Do not make weekly-route items carry full learner outcome history.

Instead, persist outcomes in the existing activity/tracking systems and update `learner_skill_states` from those outcomes.

Optional bridge entity if needed:

- `curriculum_skill_outcome_links`
  - `id`
  - `skill_node_id`
  - `attempt_id`
  - `outcome_type`
  - `mastery_signal`
  - `created_at`

## What Should Be Computed Instead Of Persisted

These should usually be computed on read:

- current conflicts
- repair suggestions
- recommended next skill per branch
- route rationale text
- capacity overages

Persist only the durable human decisions and the canonical state they affect.

## Repository Contracts

The service layer should be able to depend on repository contracts like:

- `CurriculumSourceRepository`
- `CurriculumNodeRepository`
- `LearnerRouteProfileRepository`
- `LearnerBranchActivationRepository`
- `LearnerSkillStateRepository`
- `WeeklyRouteRepository`
- `WeeklyRouteItemRepository`
- `RouteOverrideEventRepository`

Keep the repository interfaces boring.

Do not encode UI concerns into repository signatures.

## ID Strategy

Requirements:

- IDs must be stable and opaque
- imported node IDs must remain stable across re-reads of the same source version when the structure is unchanged
- weekly-route-item IDs do not need to be stable across regenerated week plans
- learner-skill-state IDs must be stable across all route generations

Practical suggestion:

- source IDs: UUID/ULID
- node IDs: UUID/ULID or deterministic IDs generated from `(source_id, normalized path, normalized_type)` during import
- weekly route IDs: UUID/ULID
- override event IDs: UUID/ULID

## Re-Import Semantics

This needs to be explicit.

Recommended v1 rule:

- each import creates a new `import_version` under the same `curriculum_source`
- node IDs stay stable where the normalized path matches
- removed nodes are marked inactive or excluded from future recommendations
- learner progress is preserved only for nodes that still map cleanly
- ambiguous remaps should be surfaced, not silently guessed

## Acceptance Criteria

This shared contract is done when:

- a schema exists for every canonical entity listed above, or an explicit decision doc explains why one was removed
- daily execution persistence is explicitly decided as `PlanItem` integration or a dedicated alternative
- route overrides are modeled separately from canonical sequence
- explicit prerequisite edges are sparse and justified, not generic by default
- repository interfaces exist for the shared entities
- at least one migration or schema scaffold demonstrates the intended relationships
- all four agent plans can point to the same field names and row ownership without contradiction

## Out Of Scope For This Contract

Do not solve these here:

- final visual design
- drag-and-drop library choice
- AI-generated curriculum parsing strategies beyond what the import plan needs
- advanced mastery theory
- graph visualization
