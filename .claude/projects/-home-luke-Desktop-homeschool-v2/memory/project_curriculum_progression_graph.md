---
name: Curriculum progression graph view
description: The /curriculum/graph secondary view was replaced with a real progression graph in April 2026
type: project
---

CurriculumGraphWorkspace (old tree-based graph) replaced by CurriculumProgressionGraph.

**New files:**
- `lib/curriculum/progression-graph-model.ts` — pure graph view model builder (buildProgressionGraph)
- `components/curriculum/curriculum-progression-graph.tsx` — client graph component
- `scripts/curriculum-progression-graph-model.test.mts` — 11 unit tests (all passing)
- `docs/plans/curriculum-progression-graph-view.md` — implementation notes

**Modified files:**
- `lib/curriculum/service.ts` — added getCurriculumProgression(sourceId) which fetches phases + skill prerequisites from DB
- `app/(parent)/curriculum/graph/page.tsx` — calls getCurriculumProgression, builds graph model, renders CurriculumProgressionGraph

**Why:** Prior graph was hierarchy-only (tree by parent-child). New graph is phase-column layout (left-to-right by phase.position) with SVG edges differentiated by kind (hardPrerequisite/solid, recommendedBefore/dashed, inferred/muted-dashed). Domain grouping shown as colored background bands per column.

**Pre-existing failing test:** `scripts/curriculum-granularity.test.mts` test 6 ("quality checks flag overly broad skills") was already failing before this work — unrelated.
