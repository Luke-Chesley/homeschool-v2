# Curriculum Progression Graph View

## What was replaced

The original `/curriculum/graph` page rendered `CurriculumGraphWorkspace`, a tree-based visualizer
that laid out curriculum nodes (domains, strands, goal groups, skills) as a hierarchical graph
derived purely from the parent-child tree structure. It had no concept of phases or prerequisite
edges — it only showed structural containment.

That component has been replaced by `CurriculumProgressionGraph`, a left-to-right skill progression
map built from real DB-persisted progression data (phases and skill prerequisites).

## How the graph layout works

Layout is **deterministic and phase-first**:

1. **Columns = phases**, ordered by `curriculum_phases.position` (ascending, left-to-right).
2. Each skill is assigned to the column of its phase. Skills with no explicit phase assignment go in
   a final "Unphased" fallback column at the right.
3. If there are zero phases, all skills go in a single "Canonical Order" fallback column.
4. Within each column, skills are sorted first by **domain sequence index**, then by
   **canonical sequence index** (the planner's canonical skill ordering). This keeps skills stable
   within a column regardless of re-renders.
5. Domain **background bands** (lightly tinted rects) group nodes visually within each column.

Node positions are calculated from fixed constants (`NODE_W = 176px`, `NODE_H = 64px`,
`COL_GAP = 80px`, `ROW_GAP = 10px`). No force simulation; positions are computed top-to-bottom
per column.

Edges are cubic Bézier SVG paths from the right edge of the source node to the left edge of the
target node. An arrowhead marker indicates direction.

## How progression vs inferred fallback is shown

A **diagnostics bar** appears above the graph. It shows:

- Green / `CheckCircle2` icon: explicit progression (phases exist in DB).
- Amber / `AlertTriangle` icon: inferred fallback (no phases in DB; sequence is canonical order only).
- Inline stats: phase count, edge count, skill count, dropped edge count if non-zero.

At the node level:
- Nodes **not** assigned to any explicit phase are rendered with a **dashed border**.
- Inferred edges are rendered in a muted, dashed style (low opacity).

At the column level:
- Fallback columns display a small `Info` icon next to their title.

## How grouping is handled

**Domains** are the primary grouping unit. Within each column, nodes are clustered by domain.
Each domain cluster gets:
- A lightly colored background band (one of 6 rotating color families: amber, sky, green, purple,
  orange, pink).
- A small domain title label inside the band.

Strand and goal group are surfaced in the **node detail panel** (click a node) but not as separate
visual layers in the graph. This keeps the layout readable for curricula with many nested levels.

## Limitations of this first pass

- **No cross-column domain lanes**: domains are grouped within each column, but there is no
  guaranteed horizontal alignment of the same domain across columns. A swimlane approach (fixed row
  per domain across all columns) would require more complex layout math and can leave large empty
  cells.
- **No zoom/pan**: the graph area scrolls horizontally. Large curricula (50+ skills) will have a
  tall, wide canvas.
- **droppedEdgeCount is always 0 at runtime** unless explicitly set by the service layer. The
  normalization step drops invalid edges at import time but does not currently persist the count to
  source metadata.
- **No edge routing**: edges overlap freely. For dense graphs, readability degrades. A future pass
  could route edges around nodes or use edge bundling.
- **Mobile is a list fallback**: the full graph is hidden on narrow viewports; a simple
  phase-then-skill list is shown instead.

## What a later polish phase could add

- Cross-column domain swimlanes with fixed row heights per domain.
- Zoom and pan controls (transform-origin based, or a library like `@xyflow/react`).
- Node search / filter by domain or phase.
- Persist `droppedEdgeCount` in source metadata so it's available without re-running normalization.
- Color nodes by learner mastery state (integrate `learner_skill_states`).
- "Show only direct prerequisites" filter to reduce visual noise on dense graphs.
- Export graph as SVG or PNG.
