# Guided Curriculum Route Plan

## Goal

Build a planning flow that lets a parent:

- import a curriculum shaped like `curriculum.json`
- browse it as an ordered hierarchy
- see the system's recommended route through that curriculum
- drag and reorder the route for the week
- pick exactly what is scheduled for a given day
- override the suggested order without silently breaking curriculum progression
- have the system detect and repair sequencing conflicts

This should become the bridge between curriculum structure and the existing planning surfaces in `app/(parent)/planning/**` and `app/(parent)/today/**`.

## Why This Needs A New Planning Layer

The current local JSON import path in [lib/curriculum/local-json-import.ts](/home/luke/Desktop/homeschool-v2/.worktrees/plan-guided-curriculum/lib/curriculum/local-json-import.ts) flattens nested curriculum content into:

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
   Shows the curriculum hierarchy, sequence, and status of each schedulable skill.

2. `Weekly Route`
   Shows what the system recommends for this week, with drag-and-drop reordering and conflict indicators.

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

## Proposed Information Model

### 1. Preserve Imported Hierarchy

Extend the imported structure so we retain all levels from `curriculum.json`:

- `domain`
- `strand`
- `goal_group`
- `skill`

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

### Override Rule

If the parent drags a later skill earlier:

- allow it
- mark the moved skill as `out_of_sequence`
- mark skipped predecessor skills as `blocked` or `deferred predecessors`
- surface a "repair route" option

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

### Drag Behavior

When a route item is dragged:

- update local optimistic order immediately
- recompute conflict indicators
- show inline badges like `depends on`, `out of order`, `repair available`
- persist the new order as a manual override

### Drag Implementation

Use a maintained React drag-and-drop library with keyboard support.

Preferred starting point:

- `@dnd-kit/core`
- `@dnd-kit/sortable`

Why:

- good control over custom sensors
- works well for sortable lists and lane-based boards
- stronger long-term fit than older libraries for nested-ish UI

## UI Surfaces

### A. Curriculum Source Detail Upgrade

Current page:

- [app/(parent)/curriculum/[sourceId]/page.tsx](/home/luke/Desktop/homeschool-v2/.worktrees/plan-guided-curriculum/app/(parent)/curriculum/[sourceId]/page.tsx)

Current tree:

- [components/curriculum/CurriculumTree.tsx](/home/luke/Desktop/homeschool-v2/.worktrees/plan-guided-curriculum/components/curriculum/CurriculumTree.tsx)

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
- conflicts / blocked items
- repair suggestions

Suggested layout:

- left rail: active curriculum branches
- center: weekly route lane with draggable cards
- right rail: conflicts, rationale, and route actions

### C. Daily Selection Surface

Integrate with the existing daily plan flow:

- [app/(parent)/planning/day/[date]/page.tsx](/home/luke/Desktop/homeschool-v2/.worktrees/plan-guided-curriculum/app/(parent)/planning/day/[date]/page.tsx)
- [app/(parent)/today/page.tsx](/home/luke/Desktop/homeschool-v2/.worktrees/plan-guided-curriculum/app/(parent)/today/page.tsx)

Add a selector that lets the parent pick from:

- recommended for today
- same-branch alternates
- recovery items
- review items

The output of daily selection should become normal `PlanItem`s so the rest of the planning stack still works.

### D. Graph View Later

After the route planner is working, add an optional graph visualization that shows:

- active branches
- prerequisite order
- current position
- blocked items
- weekly selections

This should be a support tool for understanding the route, not the primary editing surface.

## Data Layer Changes

### Phase 1: Feature-Local Types + Mock Repository

Add feature-local route models under:

- `lib/curriculum/route-types.ts`
- `lib/curriculum/route-service.ts`
- `lib/curriculum/route-mock-repository.ts`

This matches how the repo already handles planning and curriculum abstraction.

### Phase 2: Better Local JSON Import

Replace flatten-only import with a two-track import:

1. Compatibility track
   Still populate source/unit/lesson/objective so existing curriculum pages keep working.

2. Route track
   Also build route nodes and ordered edges from the raw JSON hierarchy.

Suggested parsing rule:

- top-level key => `domain`
- next-level key => `strand`
- next-level key => `goal_group`
- array items => `skill`

If a node is encountered as a plain object with mixed nesting, preserve the nesting as route nodes rather than trying to normalize it away too early.

### Phase 3: Persistence

When moving from mock to DB-backed:

- add route node table
- add route edge table
- add learner progress/status table
- add weekly route override table
- add daily assignment table

This should integrate with the existing planning and tracking schemas, not replace them.

## Integration With Existing Planning

The weekly route planner should feed, not bypass, the existing planning models in [lib/planning/types.ts](/home/luke/Desktop/homeschool-v2/.worktrees/plan-guided-curriculum/lib/planning/types.ts).

Recommended mapping:

- route skill -> candidate `PlanItem`
- weekly route -> source for `WeeklyPlan.days[].items`
- daily selected skill -> `PlanItem` with curriculum metadata attached

Extend `PlanItem` metadata to include:

- `curriculumSourceId`
- `routeNodeId`
- `branchPath`
- `progressionIndex`
- `overrideReason?`

This keeps planning, today, tracking, and copilot anchored to the same curriculum step.

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

## Suggested Delivery Phases

### Phase 0: Design + Route Model

- define route node/edge types
- define skill status model
- define weekly route and daily selection models
- define override and conflict model

Deliverable:

- stable TypeScript contracts
- importer shape decided

### Phase 1: Import + Tree Preservation

- update local JSON import to preserve hierarchy
- create mock route repository from imported JSON
- expose route tree from service layer

Deliverable:

- curriculum source can be opened as a route-aware tree

### Phase 2: Route View

- add curriculum route UI on source detail page
- show next recommended skill per active branch
- show status badges and branch activation controls

Deliverable:

- parent can inspect and activate branches

### Phase 3: Weekly Route Board

- build draggable weekly route board
- support reorder and lane movement
- compute conflicts and repair suggestions

Deliverable:

- parent can drag/reorder weekly work
- route conflicts are visible and repairable

### Phase 4: Daily Selector

- connect weekly route items into daily planning
- let parent choose today's work from the weekly queue
- convert chosen items into `PlanItem`s

Deliverable:

- daily planning is curriculum-driven instead of mock-only

### Phase 5: Tracking + Feedback Loop

- connect completion/mastery back to skill status
- use tracking outcomes to recommend review, reteach, or advance

Deliverable:

- weekly recommendations respond to actual completion and mastery

## Concrete File Plan

Likely new files:

- `.codex/guided-curriculum-route-plan.md`
- `lib/curriculum/route-types.ts`
- `lib/curriculum/route-service.ts`
- `lib/curriculum/route-mock-repository.ts`
- `components/curriculum/CurriculumRouteTree.tsx`
- `components/planning/WeeklyRouteBoard.tsx`
- `components/planning/RouteConflictPanel.tsx`
- `components/planning/DailyRouteSelector.tsx`
- `app/(parent)/curriculum/[sourceId]/route/page.tsx`
- `app/(parent)/planning/route/page.tsx`

Likely updated files:

- `lib/curriculum/local-json-import.ts`
- `lib/curriculum/types.ts`
- `lib/curriculum/service.ts`
- `lib/planning/types.ts`
- `app/(parent)/curriculum/[sourceId]/page.tsx`
- `app/(parent)/planning/page.tsx`
- `app/(parent)/planning/day/[date]/page.tsx`
- `app/(parent)/today/page.tsx`

## Open Questions

These should be answered before implementation starts:

1. Is route state per learner, per household, or both?
   Recommendation: per learner, with optional household-level defaults.

2. Should parents be able to activate multiple branches at once?
   Recommendation: yes, but with branch priorities.

3. What should "skipped" mean?
   Recommendation: keep it explicit and reversible, never hidden.

4. Should daily scheduling allow out-of-sequence work?
   Recommendation: yes, but only as an explicit override with conflict markers.

5. Should drag reorder change curriculum sequence or only weekly plan order?
   Recommendation: only weekly/daily route order at first. Do not mutate the underlying curriculum sequence model in v1.

## Recommended First Slice

The highest-value first implementation slice is:

1. Preserve imported hierarchy from `curriculum.json`
2. Build a route-aware curriculum tree
3. Compute "next recommended" skills deterministically
4. Add a draggable weekly route board
5. Feed selected route items into existing planning views

This gives you a usable guided planner quickly without prematurely building the full graph visualization or a complex adaptive engine.

## Bottom Line

The right v1 is:

- hierarchy-aware import
- deterministic recommended route
- draggable weekly route board
- daily selection from that route
- explicit conflict detection and repair

That gives parents freedom without losing the curriculum order encoded in the source material.
