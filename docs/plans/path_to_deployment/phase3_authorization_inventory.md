# Phase 3: Authorization Inventory

This is the first-pass table inventory for Phase 3. It groups the current schema into authorization families so the RLS migration work can be planned by domain instead of by random warning.

## Policy Anchor Legend

- `org_id`: row can be authorized directly from `organization_id`
- `learner_id`: row can be authorized directly from `learner_id`
- `parent_join`: row must derive authorization from a parent row
- `shared_or_org`: row may be globally readable or organization-owned depending on contents
- `server_only`: row should likely stay backend-oriented even if it remains in `public`

## Identity And Organization Family

| Table | Scope | Policy Anchor | Notes |
| --- | --- | --- | --- |
| `adult_users` | adult identity | auth user lookup | Must only expose the current adult user or rows needed through membership checks. |
| `organizations` | org | `org_id` | Read/write only through membership. |
| `memberships` | org membership | `parent_join` | Should be readable only for memberships belonging to the current adult user and their orgs. |
| `organization_platform_settings` | org | `org_id` | Straightforward org-scoped policy family. |

## Learner Family

| Table | Scope | Policy Anchor | Notes |
| --- | --- | --- | --- |
| `learners` | learner | `org_id` | Learner belongs to an organization. |
| `learner_profiles` | learner | `parent_join` | Derive through learner. |
| `learning_goals` | learner | `learner_id` | Direct learner-scoped policy. |
| `goal_mappings` | learner/standards | `parent_join` | Derive through learning goal. |

## Curriculum Family

| Table | Scope | Policy Anchor | Notes |
| --- | --- | --- | --- |
| `curriculum_sources` | org or learner | `org_id` | Primary anchor for many downstream tables. |
| `curriculum_phases` | source | `parent_join` | Derive through source. |
| `curriculum_phase_nodes` | phase/source | `parent_join` | Derive through phase/source. |
| `curriculum_progression_state` | source | `parent_join` | Derive through source. |
| `curriculum_assets` | source/storage | `parent_join` | Needs matching storage policy work. |
| `curriculum_items` | source/learner | `parent_join` | Derive through source or learner. |
| `curriculum_item_standards` | curriculum item | `parent_join` | Derive through curriculum item. |
| `curriculum_objectives` | legacy source/objective table | `parent_join` | Legacy table present in some local DBs; Phase 3 secures it conditionally if it exists. |

## Curriculum Routing Family

| Table | Scope | Policy Anchor | Notes |
| --- | --- | --- | --- |
| `curriculum_nodes` | source | `parent_join` | Derive through source. |
| `curriculum_skill_prerequisites` | source | `parent_join` | Derive through source. |
| `learner_route_profiles` | learner | `learner_id` | Direct learner policy anchor. |
| `learner_branch_activations` | learner | `learner_id` | Direct learner policy anchor. |
| `learner_skill_states` | learner | `learner_id` | Direct learner policy anchor. |
| `weekly_routes` | learner | `learner_id` | Direct learner policy anchor. |
| `weekly_route_items` | learner/weekly route | `learner_id` | Direct learner policy anchor. |
| `route_override_events` | learner | `learner_id` | Direct learner policy anchor. |
| `plan_item_curriculum_links` | planning/curriculum | `parent_join` | Derive through plan item or source. |

## Planning Family

| Table | Scope | Policy Anchor | Notes |
| --- | --- | --- | --- |
| `plans` | org + learner | `org_id` | Also constrained by learner ownership. |
| `plan_weeks` | plan | `parent_join` | Derive through plan. |
| `plan_days` | plan | `parent_join` | Derive through plan. |
| `plan_items` | plan | `parent_join` | Derive through plan/day. |
| `plan_item_standards` | plan item | `parent_join` | Derive through plan item. |
| `lesson_sessions` | org + learner | `org_id` | Sensitive operational learner data. |

## Activities Family

| Table | Scope | Policy Anchor | Notes |
| --- | --- | --- | --- |
| `generated_artifacts` | org or learner | `org_id` | May reference storage-backed outputs. |
| `interactive_activities` | org or learner | `org_id` | Lesson-linked activity definitions. |
| `activity_standards` | activity | `parent_join` | Derive through activity. |
| `activity_attempts` | learner | `learner_id` | Highly sensitive learner data. |
| `activity_evidence` | org + learner | `org_id` | Highly sensitive learner evidence. |

## Workflow And Tracking Family

| Table | Scope | Policy Anchor | Notes |
| --- | --- | --- | --- |
| `evidence_records` | org + learner | `org_id` | File-backed rows need storage alignment. |
| `evidence_record_objectives` | evidence | `parent_join` | Derive through evidence record. |
| `feedback_entries` | org + learner | `org_id` | Should stay private to the household org. |
| `review_queue_items` | org | `org_id` | Org-scoped review workflow. |
| `progress_records` | learner | `learner_id` | Direct learner policy anchor. |
| `progress_record_standards` | progress | `parent_join` | Derive through progress record. |
| `observation_notes` | org + learner | `org_id` | Learner-sensitive observational data. |

## Copilot Family

| Table | Scope | Policy Anchor | Notes |
| --- | --- | --- | --- |
| `conversation_threads` | org + learner | `org_id` | Copilot conversations are not public. |
| `conversation_messages` | thread | `parent_join` | Derive through thread. |
| `copilot_actions` | thread | `parent_join` | Derive through thread. |
| `adaptation_insights` | org + learner | `org_id` | Learner-sensitive recommendations context. |
| `recommendations` | org + learner | `org_id` | Current Security Advisor warning target. |

## Homeschool Family

| Table | Scope | Policy Anchor | Notes |
| --- | --- | --- | --- |
| `homeschool_attendance_records` | org + learner | `org_id` | Learner-linked attendance records. |
| `homeschool_audit_events` | org | `org_id` | Org-scoped audit trail. |

## Standards Family

| Table | Scope | Policy Anchor | Notes |
| --- | --- | --- | --- |
| `standard_frameworks` | shared or org | `shared_or_org` | Need explicit distinction between global and custom frameworks. |
| `standard_nodes` | framework | `parent_join` | Derive through framework. |

## Storage Surfaces To Lock Down

Current schema references indicate at least these file-backed surfaces:

- curriculum assets via `curriculum_assets.storage_bucket` and `curriculum_assets.storage_path`
- evidence uploads via `evidence_records.storage_path`
- generated artifacts and activity evidence where payloads or metadata may point at stored objects

Before implementation, confirm the actual bucket list in use and standardize path conventions to include org and learner ownership where appropriate.

## Recommended First Policy Batch

Start with the smallest set that creates a trustworthy core:

1. `adult_users`
2. `organizations`
3. `memberships`
4. `organization_platform_settings`
5. `learners`
6. `learner_profiles`
7. `learning_goals`
8. `recommendations`

That batch should remove the most obvious exposure and create reusable helper logic for later tables.
