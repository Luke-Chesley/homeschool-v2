# Agent A Plan — Import Normalization And Route Tree

## Mission

Own the ingestion side of the system.

Turn source curriculum into a persisted normalized hierarchy that the rest of the planner can trust.

## Scope

In scope:

- source-shape inspection
- normalization into `domain -> strand -> goal_group -> skill`
- hierarchy preservation metadata
- persisted normalized nodes
- source detail tree backed by normalized nodes
- re-import/version behavior

Out of scope:

- weekly route generation
- daily planning UI
- completion/mastery logic
- drag-and-drop behavior

## Core Deliverables

1. normalization rules for common source shapes
2. persisted `curriculum_sources` and `curriculum_nodes`
3. optional explicit prerequisite extraction into `curriculum_skill_prerequisites`
4. route-aware source tree read model
5. documented re-import behavior

## Product Rules

- preserve original labels even when normalizing types
- synthesize missing levels when the source is too shallow
- compress extra levels when the source is too deep
- preserve source nuance in metadata, not in the core contract
- leaf ordering is canonical sequence unless explicit prerequisite logic says otherwise

## Suggested Implementation Shape

### Step 1 — Normalization Adapter Layer

Introduce an adapter layer that can transform input shapes into a shared normalized tree payload before persistence.

Suggested responsibilities:

- detect likely level roles
- map imported labels to normalized types
- attach source metadata for inspectability
- assign stable node identities where possible

### Step 2 — Persist Canonical Tree

Persist normalized nodes into `curriculum_nodes`.

Requirements:

- sibling order persisted in `sequence_index`
- all nodes reference `source_id`
- parent-child relationships are explicit
- leaf nodes are clearly queryable

### Step 3 — Tree Read Model

Expose a service-layer method that returns a normalized tree for the source detail page.

The read model should make it easy for downstream route generation to ask:

- what are the active leaves under this branch?
- what is the first incomplete leaf under this branch?
- what is the canonical next leaf after this one?

### Step 4 — Re-Import Rules

Define how repeated imports behave.

Recommended v1 behavior:

- create a new source version
- keep stable node identity where normalized path matches
- surface unmatched nodes for manual review if mapping is ambiguous

## Key Engineering Decisions

- keep import logic deterministic for the same source input
- do not leak UI-only tree state into the import layer
- do not let import logic invent weekly scheduling behavior
- store original source shape as metadata only where actually helpful

## Acceptance Criteria

This plan is done when all of the following are true:

- a representative `curriculum.json` import produces persisted normalized nodes
- normalization supports at least one shallower and one deeper shape than the prototype source
- the source detail service can load the normalized tree from persistence rather than mock-only flattening
- stable sibling order is preserved for all leaf skills
- at least one re-import case is defined and tested
- explicit prerequisite edges are only persisted when justified beyond simple leaf order
- imported nodes retain original labels and normalized types without losing inspectability

## Test Cases

Minimum tests:

- exact prototype JSON shape imports cleanly
- shallow source with only subject + skill list gets synthesized grouping nodes
- deep source with extra nesting compresses into normalized types without losing labels
- repeated import of unchanged source preserves stable node mapping
- changed import version does not silently corrupt learner progress mappings

## Handoff To Other Agents

Agent A unblocks everyone else by making these stable:

- `curriculum_source.id`
- `curriculum_node.id`
- `curriculum_node.normalized_type`
- `curriculum_node.parent_id`
- `curriculum_node.sequence_index`
- any sparse prerequisite edges

Update `STATUS.md` as soon as those are contract-safe.
