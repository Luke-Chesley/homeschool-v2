# Agent Execution Playbook

## Purpose

This file is the operator guide for running the curriculum-plan work with multiple coding agents.

It answers:

- how many agents to run
- in what order to run them
- what to tell each one
- what should wait for a shared contract first
- how to keep them from drifting into incompatible implementations

## Recommended Number Of Agents

The ideal number is **four feature agents plus one coordinator role played by you**.

Do not use more than four implementation agents for this scope.

More than four agents will increase merge noise faster than it increases useful throughput.

## Best Execution Pattern

Do **not** start all four agents at the exact same time with no frozen contract.

That is the easiest way to get:

- incompatible table shapes
- duplicate abstractions
- different naming conventions
- conflicting assumptions about `PlanItem`, learner progress, and weekly route ownership

The best pattern is a **staggered parallel start**.

## Recommended Sequence

### Stage 0 — Contract Freeze

Run **one agent first** or do this yourself.

Objective:

- confirm the shared persistence contract
- confirm naming and ownership of the core rows
- confirm `PlanItem` integration strategy
- confirm acceptance criteria

This stage should produce or validate:

- `00-shared-data-model-and-persistence.md`
- any schema scaffolding PR
- any naming changes needed before feature work begins

You should not start broad feature implementation until this stage is accepted.

### Stage 1 — Start Agent A First

Once the shared contract is stable, start **Agent A**.

Agent A owns the normalized curriculum tree and is the cleanest upstream dependency for the others.

Why Agent A first:

- Agent B needs stable curriculum nodes and sequence semantics.
- Agent C needs stable curriculum skill IDs for daily assignment.
- Agent D needs stable curriculum skill IDs for feedback linkage.

### Stage 2 — Start Agents B, C, And D In Parallel

After Agent A's contract-facing pieces are stable, you can run **Agents B, C, and D at the same time** on separate branches.

They do not need to wait for each other to finish.

They only need the shared contract plus Agent A's node identity semantics to be stable.

## Practical Recommendation

### Safest approach

1. shared contract/schema
2. Agent A starts
3. once stable IDs and node semantics are clear, start B/C/D together
4. merge in this order: contract -> A -> B -> C -> D

### Fastest acceptable approach

1. shared contract/schema
2. start A and B together
3. start C and D once B's weekly-route item contract is clear

I do **not** recommend starting C before there is a stable weekly-route item contract.

## What You Should Tell Each Agent

Use short, strict instructions.

Do not give each agent the whole vision doc and tell them to improvise.

Give each agent:

- the master plan directory
- their single owned plan file
- the shared contract file
- `STATUS.md`
- a hard statement of what they may not change without coordination

## Shared Instruction Block For Every Agent

Use something like this:

> You are one agent working on the curriculum-plan initiative.
> Read `.codex/curriculum-plan/README.md`, `.codex/curriculum-plan/STATUS.md`, and `.codex/curriculum-plan/00-shared-data-model-and-persistence.md` first.
> Then read only your assigned plan file.
> You own only that scope.
> Do not invent new shared contracts unless absolutely necessary.
> If you need a shared-contract change, add it under `Open Contract Changes` in `STATUS.md` before implementing it.
> Update `STATUS.md` with status, blockers, and acceptance-criteria progress in your PR.
> Do not mutate canonical curriculum sequence to implement weekly or daily reorder behavior.
> Keep daily execution in normal `PlanItem` flow unless the shared contract explicitly changes.

## Agent-Specific Instruction Blocks

### Agent A

> Own import normalization and persisted curriculum nodes.
> Read `01-agent-a-import-normalization.md`.
> Your job is to make normalized curriculum tree persistence and stable node identity real.
> Do not implement weekly route logic, daily planning logic, or mastery/recommendation logic.
> Your main output is trustworthy persisted normalized nodes and source-tree reads.

### Agent B

> Own deterministic weekly route generation, weekly route persistence, reorder overrides, conflicts, and repair preview.
> Read `02-agent-b-weekly-route.md`.
> Do not change canonical curriculum sequence.
> Do not invent a new daily execution model.
> Your main output is a persisted weekly route plus deterministic conflict/repair behavior.

### Agent C

> Own daily selection, `PlanItem` integration, deferral, and curriculum-backed today-view actions.
> Read `03-agent-c-daily-selection-and-deferral.md`.
> Use `PlanItem` as the canonical daily execution object unless the shared contract explicitly changes.
> Do not implement import normalization or route-generation logic.
> Your main output is safe daily execution with preserved curriculum context.

### Agent D

> Own tracking, feedback, mastery handling, and recommendation adaptation.
> Read `04-agent-d-tracking-and-feedback.md`.
> Use existing outcome/tracking systems where possible and update learner skill state as the canonical curriculum progress summary.
> Do not redesign the weekly board or daily planner.
> Your main output is deterministic feedback-driven state transitions and route adaptation rules.

## Merge And Review Rules

Tell every agent this too:

- update `STATUS.md` in the same PR
- do not silently expand shared contracts
- call out any required schema change explicitly
- keep PRs focused on one plan
- if a contract shift touches another agent, note that in `STATUS.md`

## What To Review Before Merging

For every agent PR, check:

1. Did the agent stay in scope?
2. Did they change a shared contract without documenting it?
3. Did they add a second representation for something that already has a canonical table/object?
4. Did they preserve the acceptance criteria from their plan?
5. Did they update `STATUS.md`?

## Exact Recommended Rollout

If you want the highest chance of success, do this:

1. Merge the planning-doc PR.
2. Merge the schema/contract PR.
3. Launch Agent A.
4. Once Agent A has stable node identity and tree semantics, launch Agents B, C, and D in parallel.
5. Merge B.
6. Merge C.
7. Merge D.
8. Run a final integration pass after all four are in.

## Bottom Line

- **Yes**, multiple agents make sense here.
- **No**, they should not all start at once from a vague shared idea.
- The right shape is **contract first, Agent A next, then B/C/D in parallel**.
- Four implementation agents is the right maximum for this scope.
