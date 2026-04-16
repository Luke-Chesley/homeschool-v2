# Guided Curriculum Route Plan

## Goal

Build a planning flow that lets a parent:

- import curriculum from a range of common hierarchical formats
- have the system approximate that content into a route-friendly structure
- browse the curriculum as an ordered progression
- see the system's recommended route through that curriculum
- drag and reorder the route for the week
- choose exactly what is scheduled for a given day
- control the daily workload in terms of how many lowest-level items are attempted per day
- push work from one day to the next without breaking the overall route
- override the suggested order without silently breaking curriculum progression
- have the system detect and repair sequencing conflicts

This should become the bridge between curriculum structure and the existing planning surfaces in `app/(parent)/planning/**` and `app/(parent)/today/**`.

## Core Product Direction

The imported `curriculum.json` shape is a strong starting framework, but it should not become a rigid requirement.

The system should implicitly understand curriculum that looks roughly like:

- domain / subject
- strand / category
- goal / section header
- ordered skill or lesson items

That shape should become the internal planning framework even when imported curriculum does not match it exactly.

The product goal is not "only support files that look exactly like this JSON."
The product goal is "recognize a finite set of common curriculum shapes and normalize them into a planning structure that behaves like this one."

## Why This Needs A New Planning Layer

The current local JSON import path in [lib/curriculum/local-json-import.ts](/home/luke/Desktop/learning/homeschool-v2/lib/curriculum/local-json-import.ts) flattens nested curriculum content into:

- source
- units
- lessons
- objectives

That is enough for browsing, but not enough for progression-aware planning.

The imported JSON already contains richer semantics:

- top-level subject/domain
- subdomain / strand
- goal / section header
- ordered skill statements at the leaf level

Inside each leaf list, sequence already matters. That list order should become the default recommendation order. Right now the importer preserves text, but it does not preserve enough structural meaning to drive a route planner.

## Product Shape

Do not start with a knowledge graph as the primary interaction model.

Start with three linked views:

1. `Curriculum Route`
   Shows the curriculum hierarchy, sequence, status, and active branches for each learner.

2. `Weekly Route`
   Shows what the system recommends for this week, with drag-and-drop reordering, workload controls, and conflict indicators.

3. `Daily Selection`
   Lets the parent assign today's work from the weekly route, alternate options, and recovery items.

Add a graph visualization later as an explanation layer, not the main control surface.

## UX Principles

- The default route should feel opinionated, not empty.
- The parent must always be able to override the suggestion.
- Overrides must be visible and reversible.
- The system should never silently violate sequence rules.
- Dragging should be lightweight and immediate.
- Weekly planning should show both "what is next" and "why it is next."
- Daily planning should feel like choosing from a guided queue, not reconstructing the curriculum from scratch.
- Parents should be able to adjust workload without manually rebuilding the whole week.
- Deferring work to the next day should be a normal operation, not an error state.

## Flexible Import Normalization

### Import Principle

We should treat the `curriculum.json` example as the best current prototype for internal structure, not the only accepted source shape.

New curriculum imports should be normalized into an approximate internal hierarchy even if they originate from:

- nested JSON
- manual entry
- PDF extraction
- pasted text
- external curriculum APIs

### Internal Normalization Target

The system should try to infer a route-friendly shape like:

- `domain`
- `strand`
- `goal_group`
- `skill`

This means:

- if a source has more levels, compress or map them into this framework
- if a source has fewer levels, synthesize missing grouping nodes
- if labels are inconsistent, preserve originals but map them into the normalized structure

The imported hierarchy should remain inspectable, but the planning system should always operate on the normalized route structure.

### Approximation Rule

There are only a finite number of curriculum shapes that matter in practice. The system should be designed to approximate them into a shared planning model rather than requiring exact structural matches.

This should be an explicit product assumption in the implementation:

- parse the source shape
- infer hierarchy roles
- preserve source labels
- generate normalized planning nodes

## Proposed Information Model

### 1. Preserve Imported Hierarchy

Extend the imported structure so we retain all levels from `curriculum.json` when they exist:

- `domain`
- `strand`
- `goal_group`
- `skill`

If imported curriculum does not exactly match this structure, normalize it into the closest approximation while preserving the original labels and tree shape as metadata.

The current `unit -> lesson -> objective` abstraction can still exist for compatibility, but the new route planner should use an explicit node model.

### 2. New Curriculum Route Node

Introduce a new feature-local type set under `lib/curriculum`:

- `CurriculumRouteNode`
- `CurriculumRouteEdge`
- `CurriculumSkillStatus`
- `CurriculumWeeklyRoute`
- `CurriculumDailySelectionCandidate`

Suggested node shape:

```ts
type CurriculumRouteNodeType = "domain" | "strand" | "goal_group" | "skill";

interface CurriculumRouteNode {
  id: string;
  sourceId: string;
  type: CurriculumRouteNodeType;
  parentId: string | null;
  title: string;
  code?: string;
  description?: string;
  sequence: number;
  path: string[];
  metadata: {
    originalLabel?: string;
    inferredType?: string;
    progressionIndex?: number;
    estimatedMinutes?: number;
    tags?: string[];
  };
}
```

Suggested edge shape:

```ts
type CurriculumRouteEdgeType =
  | "parent_of"
  | "next_in_sequence"
  | "recommended_for_week"
  | "scheduled_for_day"
  | "blocked_by"
  | "overridden_from";
```

We do not need a graph database for this. This can be modeled in app logic and persisted in relational tables later.

### 3. Skill Status

Each leaf skill needs an explicit status per learner:

- `not_started`
- `recommended`
- `scheduled`
- `in_progress`
- `completed`
- `mastered`
- `blocked`
- `paused`
- `skipped`
- `out_of_sequence`

This is the minimum required to support both deterministic recommendations and parent overrides.

### 4. Route State Scope

Route state should be per learner.

That means:

- active branches are per learner
- progress is per learner
- skipped status is per learner
- weekly route and daily assignments are per learner

Household-level defaults can exist later, but the operational route belongs to the learner.

## Recommendation Rules

Start deterministic. Do not make this AI-first.

### Default Recommendation Rule

For each active curriculum branch:

- find the first incomplete skill in sequence
- recommend that skill as the branch's next step
- do not recommend later skills unless the parent has explicitly advanced past earlier ones

### Weekly Route Rule

Generate a weekly route by:

- selecting the active branches for the learner
- taking the next eligible skill from each branch
- continuing until weekly capacity is filled
- respecting pacing constraints already used by planning
- preferring unfinished scheduled work before introducing new work

### Daily Workload Rule

The parent should be able to control the expected workload per day based on the lowest-level curriculum items.

At minimum, allow the parent to set:

- target number of skills/items per day
- optional target minutes per day
- optional branch weighting or priority

The system should then use those settings when generating the weekly route and daily recommendations.

Example:

- `2 skills per day`
- `3 skills per day on light weekdays`
- `1 item on Fridays`

The key product behavior is that the parent can tune how much curriculum gets pulled forward per day without manually editing the whole route.

### Override Rule

If the parent drags a later skill earlier:

- allow it
- mark the moved skill as `out_of_sequence`
- mark skipped predecessor skills as `blocked` or `deferred predecessors`
- surface a "repair route" option

### Push-To-Next-Day Rule

Parents should be able to push an item from today to tomorrow or to the next open day as a normal planning action.

That action should:

- preserve the item and its curriculum context
- move it forward without data loss
- update the weekly route
- recompute conflicts only if the move affects sequence or capacity

This should feel like a standard deferral action, not a special-case recovery flow.

### Auto-Correction Rule

When the parent asks the system to clean up the route:

- move unresolved prerequisite skills ahead of dependent skills
- preserve already completed work
- preserve explicit manual pins where possible
- show the diff before applying

### Guardrails

- Never auto-reorder completed items.
- Never delete manual decisions silently.
- If a drag introduces a conflict, show the conflict immediately in the route UI.
- Let parents choose between `keep override` and `repair to recommended order`.

## Draggable Interaction Model

Dragging is important here, but it should be limited to the correct level.

### Drag Targets

Allow drag-and-drop for:

- weekly route items
- daily route items
- optionally, active branch priorities

Do not start by making the entire curriculum tree draggable.

Dragging the entire hierarchy creates avoidable complexity:

- harder accessibility
- harder sequence validation
- unclear persistence semantics
- high risk of accidental structure edits

Instead:

- curriculum tree = browse + activate + inspect
- weekly route board = reorder
- daily plan list = reorder

### Drag Scope

Dragging should change:

- weekly route order
- daily route order

Dragging should not change:

- the underlying curriculum sequence itself

That sequence remains the canonical recommendation order. Dragging is a planning override, not a curriculum rewrite.

### Drag Behavior

When a route item is dragged:

- update local optimistic order immediately
- recompute conflict indicators
- show inline badges like `depends on`, `out of order`, `repair available`
- persist the new order as a manual override

## UI Surfaces

### A. Curriculum Source Detail Upgrade

Current page:

- [app/(parent)/curriculum/[sourceId]/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/curriculum/[sourceId]/page.tsx>)

Current tree:

- [components/curriculum/CurriculumTree.tsx](/home/luke/Desktop/learning/homeschool-v2/components/curriculum/CurriculumTree.tsx)

Upgrade this page into a route-aware source page with three panes:

- left: hierarchical curriculum route tree
- center: branch detail and next-skill queue
- right: weekly route summary and actions

New actions on tree nodes:

- `Set active for learner`
- `Add to weekly route`
- `Pause branch`
- `Mark complete`
- `Start from here`

Parents should be able to activate multiple branches at once.

### B. New Planning View: Weekly Route

Add a new planning tab or subview under planning:

- `Overview`
- `Weekly Route`
- `Day Plan`
- `Today`

This view should show:

- current active branches
- recommended next skills
- draggable weekly queue
- capacity meter for the week
- workload controls
- conflicts / blocked items
- repair suggestions

Suggested layout:

- left rail: active curriculum branches
- center: weekly route lane with draggable cards
- right rail: workload settings, conflicts, rationale, and route actions

### C. Daily Selection Surface

Integrate with the existing daily plan flow:

- [app/(parent)/planning/day/[date]/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/planning/day/[date]/page.tsx>)
- [app/(parent)/today/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/today/page.tsx>)

Add a selector that lets the parent pick from:

- recommended for today
- same-branch alternates
- recovery items
- review items

The output of daily selection should become normal `PlanItem`s so the rest of the planning stack still works.

### D. Today View

The today view should reflect the active plan for getting through the day, not just a static list of scheduled items.

It should show:

- active items for today
- current recommended order of attack
- key context for each item
- what was deferred from earlier in the week
- quick actions like `push to tomorrow`, `mark complete`, `swap with alternate`

This is where the route turns into execution.

### E. Graph View Later

After the route planner is working, add an optional graph visualization that shows:

- active branches
- prerequisite order
- current position
- blocked items
- weekly selections

This should be a support tool for understanding the route, not the primary editing surface.

## Conflict Handling

We need first-class conflict states, not just validation errors.

### Conflict Types

- predecessor not completed
- predecessor paused
- item scheduled twice
- dragged past blocked dependency
- branch exceeds weekly capacity
- parent selected two mutually exclusive next skills in the same narrow branch

### Conflict UI

Each conflict should show:

- what is wrong
- why it is wrong
- what the system suggests
- whether the parent can keep the override anyway

Example:

`II-OL4.4b` is scheduled before `II-OL4.3b`.
Suggested fix: move `II-OL4.3b` earlier or mark it intentionally skipped.

## Product Decisions Confirmed

These are no longer open questions:

1. Route state is per learner.
2. Parents can activate multiple branches at once.
3. `Skipped` stays explicit and reversible.
4. Daily scheduling can allow out-of-sequence work.
5. Drag reorder changes weekly and daily plan order only, not canonical curriculum sequence.

## Suggested Delivery Phases

### Phase 0: Normalization + Route Model

- define flexible import normalization rules
- define route node/edge types
- define skill status model
- define weekly route and daily selection models
- define override and conflict model
- define daily workload controls

Deliverable:

- stable product model
- normalization rules decided

### Phase 1: Import + Tree Preservation

- update local JSON import to preserve hierarchy
- add normalization rules for adjacent curriculum shapes
- create mock route repository from normalized curriculum
- expose route tree from service layer

Deliverable:

- curriculum source can be opened as a normalized route-aware tree

### Phase 2: Route View

- add curriculum route UI on source detail page
- show next recommended skill per active branch
- show status badges and branch activation controls

Deliverable:

- parent can inspect and activate branches

### Phase 3: Weekly Route Board

- build draggable weekly route board
- support reorder and lane movement
- add workload-per-day controls
- compute conflicts and repair suggestions

Deliverable:

- parent can drag/reorder weekly work
- parent can control how much is attempted per day
- route conflicts are visible and repairable

### Phase 4: Daily Selector + Deferral

- connect weekly route items into daily planning
- let parent choose today's work from the weekly queue
- support pushing work to the next day
- convert chosen items into `PlanItem`s

Deliverable:

- daily planning is curriculum-driven instead of mock-only
- deferring work to the next day is simple and safe

### Phase 5: Tracking + Feedback Loop

- connect completion/mastery back to skill status
- use tracking outcomes to recommend review, reteach, or advance

Deliverable:

- weekly recommendations respond to actual completion and mastery

## Recommended First Slice

The highest-value first implementation slice is:

1. Preserve and normalize imported hierarchy from `curriculum.json`
2. Build a route-aware curriculum tree
3. Compute "next recommended" skills deterministically
4. Add workload-per-day controls
5. Add a draggable weekly route board
6. Feed selected route items into existing planning views
7. Support pushing unfinished items to the next day

This gives you a usable guided planner quickly without prematurely building the full graph visualization or a complex adaptive engine.

## Bottom Line

The right v1 is:

- flexible hierarchy normalization based on common curriculum shapes
- deterministic recommended route
- draggable weekly route board
- daily workload controls
- daily selection from that route
- easy push-to-next-day behavior
- explicit conflict detection and repair

That gives parents freedom without losing the curriculum order encoded in the source material.
