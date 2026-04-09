# Contract: Curriculum Progression UI View Model

- **Status:** Active
- **Canonical Artifact Name:** CurriculumProgressionViewModel
- **Current Version:** 2.0

## Purpose
This contract defines the stable graph payload consumed by the curriculum UI. It combines resolved progression data with diagnostics and optional debug data from `learning-core` prompt previews.

## Producers
- **Entrypoints:**
  - `app/api/curriculum/sources/[sourceId]/graph/route.ts`
  - `lib/curriculum/service.ts`
- **Canonical Source Files:**
  - `lib/curriculum/service.ts`
  - `components/curriculum/curriculum-progression-graph.tsx`

## Consumers
- **Entrypoints:** `components/curriculum/curriculum-progression-graph.tsx`
- **Processing Logic:** The UI renders graph nodes, phases, and diagnostics directly from this view model.

## Persistence
- **Storage Location:** Not persisted. Built on demand from resolved progression data and source metadata.
- **Storage Shape:** Local view-model object for the curriculum graph screen.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| source | object | Source id and title for the graph. |
| diagnostics | object | Explicit state, fallback state, and failure/debug metadata. |
| graph | object | Render-ready phases, nodes, and edges. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| debug | object | Prompt-input or attempt/debug summaries when the UI requests them. |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| graph.edges[].inferred | diagnostics + edge kind | Signals whether an edge came from explicit progression or local fallback logic. |

## Defaults & Fallbacks
- The UI must surface fallback state and failure state explicitly. It must not hide them behind a generic “ready” graph.

## Validation & Invariants
- Diagnostics must describe whether progression is explicit, failed, fallback-only, not-attempted, or stale.
- Graph nodes and phases must remain consistent with the resolved progression contract.

## Ownership & Hierarchy
- **Parent:** Curriculum source
- **Children:** Visual graph nodes, edges, and debug panels

## Change Impact
- **Downstream Effects:** Changes affect the curriculum graph route and related debug tooling.
- **Related Contracts:** `curriculum-progression-resolved.md`

## Known Gaps / TODOs
- Debug payloads are intentionally loose until prompt-preview/debug tooling is unified further across curriculum surfaces.
