# Agent D Plan — Tracking, Mastery Feedback, And Recommendation Adaptation

## Mission

Own the feedback loop that turns daily execution outcomes into learner skill state and smarter deterministic recommendations.

## Scope

In scope:

- mapping completion and mastery outcomes back to `learner_skill_states`
- preserving the relationship between attempts/outcomes and curriculum skills
- deterministic review and reteach recommendation rules
- route adaptation rules that respond to outcomes

Out of scope:

- source import
- weekly route board UI
- daily selection mechanics except for consuming emitted execution events

## Required Inputs

This plan assumes stable contracts for:

- `curriculum_skill_node_id`
- `weekly_route_item_id` where relevant
- activity attempt or outcome identifiers
- learner skill state statuses

## Product Rules

- completion and mastery are not the same thing
- unfinished scheduled work should usually be preferred before new work
- weak outcome signals should produce deterministic review or reteach suggestions
- completed work should not be silently reordered backward
- explicit skips and overrides should remain visible to the recommendation layer

## Persistence Recommendation

Use the existing activity/tracking systems for raw outcome history.

Update `learner_skill_states` as the canonical summary row for curriculum progress.

Optional bridge rows are acceptable only if needed to link attempts cleanly to curriculum skills.

## Suggested State Transition Rules

Examples:

- `not_started -> scheduled` when added to the weekly/daily plan
- `scheduled -> in_progress` when work starts
- `in_progress -> completed` when the attempt is done
- `completed -> mastered` only when outcome logic supports it
- `completed -> recommended` for review if performance was weak
- `out_of_sequence` remains explicit until repaired or acknowledged

## Recommendation Adaptation Rules

Recommended deterministic v1 rules:

- prefer unfinished scheduled items before new items
- if a completed skill has weak mastery signals, surface a review item before advancing too far
- if a skill is strongly mastered, allow normal branch advancement
- if a prerequisite remains skipped or blocked, keep that conflict visible even when downstream work happened

## Acceptance Criteria

This plan is done when all of the following are true:

- completion events update `learner_skill_states`
- mastery and non-mastery outcomes can be distinguished in persisted learner skill state
- deterministic review or reteach recommendations are produced from outcome inputs
- weekly route generation can consume updated learner skill state without special-case hacks
- unfinished scheduled work is preferred before introducing new work after feedback is applied
- outcome linkage to curriculum skill identity is auditable

## Test Cases

Minimum tests:

- completing a curriculum-backed `PlanItem` updates learner skill state
- strong outcome marks a skill completed or mastered according to the rule set
- weak outcome generates a review or reteach recommendation deterministically
- downstream route generation respects updated learner state
- out-of-sequence and skipped states remain visible after outcome updates

## Handoff To Other Agents

Agent D must make these stable for downstream consumers:

- learner skill state transition semantics
- outcome-to-skill linkage contract
- recommendation adjustment rules that Agent B can consume
- any review/reteach flags that appear in daily selection surfaces

Update `STATUS.md` when those are contract-safe.
