# Contract: Curriculum Progression Resolved

- **Status:** Active
- **Canonical Artifact Name:** CurriculumProgressionResolved
- **Current Version:** 2.0

## Purpose
This contract describes the server-side resolved progression structure after `skillRef` values from `learning-core` are mapped back to persisted curriculum node ids.

## Producers
- **Entrypoints:** `lib/curriculum/normalization.ts`
- **Canonical Source Files:**
  - `lib/curriculum/progression-graph-model.ts`
  - `lib/curriculum/normalization.ts`

## Consumers
- **Entrypoints:**
  - `lib/curriculum/service.ts`
  - `lib/curriculum-routing/service.ts`
- **Processing Logic:**
  - The resolved model is what planning and graph rendering consume.

## Persistence
- **Storage Location:** Normalized progression data in curriculum-related persistence plus diagnostics metadata.
- **Storage Shape:** Local resolved object with `phases`, `edges`, and `diagnostics`.

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| sourceId | string | Curriculum source id. |
| phases | array | Resolved phases with ordered node ids and source `skillRef` values. |
| edges | array | Resolved edges with node ids and original `skillRef` values. |
| diagnostics | object | Resolution and validation diagnostics. |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| phases[].description | string | Optional phase description. |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| diagnostics.acceptedEdgeCount | edges | Counted after semantic validation. |
| diagnostics.droppedEdgeCount | resolution | Count of edges rejected during resolution/validation. |

## Defaults & Fallbacks
- Explicit progression is preferred. Any inferred fallback logic is surfaced in diagnostics rather than hidden.

## Validation & Invariants
- Every `nodeId` must map to an existing curriculum node.
- `hardPrerequisite` edges must remain acyclic after resolution.
- Diagnostics must declare whether inferred fallback logic was used.

## Ownership & Hierarchy
- **Parent:** Curriculum source
- **Children:** UI graph view model and planning order derivations

## Change Impact
- **Downstream Effects:** Changes affect weekly routing, graph rendering, and conflict diagnostics.
- **Related Contracts:** `curriculum-progression-ui-view-model.md`

## Known Gaps / TODOs
- The resolved shape still carries local diagnostics that are not shared with `learning-core`.
