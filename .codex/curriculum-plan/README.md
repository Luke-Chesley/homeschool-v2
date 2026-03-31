# Curriculum Planning Master Plan

## Why This Exists

The original guided curriculum route plan is directionally strong, but too broad to hand to multiple agents as a single workstream.

This directory turns that product direction into:

- a shared persistence contract
- explicit acceptance criteria
- four coordinated agent plans
- a simple status dashboard that all agents can update without stepping on each other

## Recommendation

Do **not** let four agents independently invent data models or route semantics.

That is the main failure mode.

The right split is:

1. freeze the shared persistence and service contracts first
2. let four agents work mostly in parallel against those contracts
3. require each agent to update `STATUS.md` whenever scope, blockers, or done state changes

## Files In This Directory

- `README.md`
  master plan, dependencies, coordination rules, and overall definition of done
- `STATUS.md`
  lightweight dashboard for agent coordination
- `00-shared-data-model-and-persistence.md`
  canonical persistence design and shared contracts
- `01-agent-a-import-normalization.md`
  import pipeline and normalized curriculum tree
- `02-agent-b-weekly-route.md`
  deterministic route generation, weekly route board, conflicts, and repair
- `03-agent-c-daily-selection-and-deferral.md`
  daily planning integration, plan-item creation, and push-to-next-day flows
- `04-agent-d-tracking-and-feedback.md`
  completion/mastery feedback loop and route adaptation rules

## High-Level Dependency Graph

There is one real core dependency:

- `00-shared-data-model-and-persistence.md`

Everything else depends on its contracts.

After the contracts are accepted, the work can split like this:

- Agent A can build import normalization and persisted curriculum nodes.
- Agent B can build weekly route generation and weekly-route persistence against fixture or repository adapters.
- Agent C can build daily selection and deferral using the existing planning stack plus the agreed curriculum metadata contract.
- Agent D can build completion/mastery feedback and recommendation adjustments against the same learner-skill-state contract.

## Branching And Coordination Pattern

Suggested branch names:

- `agent-a/curriculum-import-normalization`
- `agent-b/weekly-route-board`
- `agent-c/daily-selection-deferral`
- `agent-d/tracking-feedback-loop`

### Rules

1. Every agent may update `STATUS.md`.
2. Every agent owns exactly one plan file plus their code branch.
3. No agent should change the shared contract doc after implementation starts unless the change is called out in `STATUS.md` under `Open contract changes`.
4. Do not merge feature branches that silently expand the shared contract.
5. If an agent needs a new field or semantic, they should propose it in `STATUS.md` first and mark all affected agents.

## What Must Be Decided Before Parallel Implementation

The following items should be considered contract-frozen before major code work merges:

- canonical persisted entities
- stable IDs and foreign-key relationships
- whether daily curriculum selections persist as dedicated route rows, existing `PlanItem`s, or both
- whether conflicts are computed on read or materialized
- exact override semantics for skip, defer, pin, and out-of-sequence scheduling

This plan recommends:

- a canonical relational model
- `PlanItem` as the persisted daily execution object
- computed conflicts, with only explicit overrides and resolutions persisted
- default prerequisite behavior from sequence order, with sparse explicit prerequisite edges only when needed

## Overall Definition Of Done

This initiative is done when all of the following are true:

- imported curriculum is normalized into stable persisted nodes
- a learner can activate branches and get deterministic next-skill recommendations
- a weekly route can be generated, reordered, and persisted without mutating canonical curriculum sequence
- daily selections become normal `PlanItem`s with curriculum metadata
- parents can push unfinished work to the next day without losing curriculum context
- completion and mastery outcomes update learner skill state
- route recommendations respond to unfinished work, completion, mastery, and explicit overrides
- the critical flows have automated verification

## Minimum Automated Verification For This Initiative

At minimum, CI should prove:

- `corepack pnpm typecheck` succeeds from a clean checkout
- `corepack pnpm build` succeeds
- a representative curriculum import produces normalized nodes
- weekly route generation is deterministic for fixed input data
- daily selection creates a `PlanItem` linked to curriculum metadata
- push-to-next-day preserves references and recomputes conflicts/capacity
- completion/mastery updates feed back into learner skill state

## Merge Strategy

The best merge order is:

1. shared contracts and migration scaffolding
2. import normalization and persisted normalized tree
3. weekly route generation and persistence
4. daily selection and deferral integration
5. tracking/feedback loop and recommendation refinements

Agents B, C, and D can still build most of their work in parallel after step 1, but that should be the merge order unless the implementation proves a better dependency path.

## Non-Goals For V1

Avoid turning this into any of the following too early:

- a graph-database project
- an AI-first routing engine
- a drag-anything-in-the-tree editor
- a full standards/mastery expert system
- a generic workflow engine

The v1 bar is a deterministic, progression-aware, parent-overridable planning system built on a stable relational model.
