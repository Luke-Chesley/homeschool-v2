# Contract: Curriculum Progression UI View Model

- **Status:** Active
- **Canonical Artifact Name:** CurriculumProgressionViewModel
- **Current Version:** 2.0

## Purpose
Defines the stable shape the graph UI consumes. The UI uses this model without needing to infer whether failures were parse, schema, semantic, or transport.

## Producers
- **Entrypoints:** `lib/curriculum/service.ts` (API route providing graph data)

## Consumers
- **Entrypoints:** `components/curriculum/curriculum-progression-graph.tsx`

## Persistence
- **Storage Location:** Not persisted, constructed on the fly from `CurriculumProgressionResolved` and DB attempt metadata.

## Field Definitions

```typescript
type CurriculumProgressionViewModel = {
  source: {
    sourceId: string
    title: string
  }
  diagnostics: {
    progressionStatus: "explicit_ready" | "explicit_failed" | "fallback_only" | "not_attempted" | "stale"
    usingInferredFallback: boolean
    lastAttemptAt: string | null
    attemptCount: number
    phaseCount: number
    acceptedEdgeCount: number
    droppedEdgeCount: number
    lastFailureCategory:
      | "transport"
      | "parse"
      | "schema"
      | "semantic"
      | "unknown"
      | null
    lastFailureReason: string | null
    availableActions: Array<"regenerate_progression" | "view_prompt" | "view_attempts">
  }
  graph: {
    nodes: Array<{
      nodeId: string
      skillRef: string
      label: string
      phaseIndex: number | null
      domainTitle?: string | null
      strandTitle?: string | null
      goalGroupTitle?: string | null
    }>
    edges: Array<{
      fromNodeId: string
      toNodeId: string
      kind: "hardPrerequisite" | "recommendedBefore" | "revisitAfter" | "coPractice" | "inferred"
      inferred: boolean
    }>
    phases: Array<{
      title: string
      description?: string | null
      position: number
      nodeIds: string[]
    }>
  }
  debug?: {
    promptInput?: unknown
    rawAttemptSummaries?: unknown[]
  }
}
```

## Rules
- Exposes exact failure modes and fallback states directly to the UI.
- `inferred` flag on edges allows UI to distinguish fallback logic from explicit model output.
