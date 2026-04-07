# Contract: Curriculum Progression Resolved

- **Status:** Active
- **Canonical Artifact Name:** CurriculumProgressionResolved
- **Current Version:** 2.0

## Purpose
Defines the resolved server-side shape after `skillRef`s are matched back to database `nodeId`s. Validation and persistence happen on this resolved data.

## Producers
- **Entrypoints:** `lib/curriculum/normalization.ts` and `lib/curriculum/progression-validation.ts`
- **Canonical Source Files:** `lib/curriculum/progression-graph-model.ts`

## Consumers
- **Entrypoints:** Database persistence and UI Graph Model generation.

## Persistence
- **Storage Location:** Stored as normalized progression data (phases and edges) in the database with associated metadata for diagnostics.

## Field Definitions

```typescript
type CurriculumProgressionResolved = {
  sourceId: string
  phases: Array<{
    title: string
    description?: string | null
    position: number
    nodeIds: string[]
    skillRefs: string[]
  }>
  edges: Array<{
    fromNodeId: string
    toNodeId: string
    fromSkillRef: string
    toSkillRef: string
    kind: "hardPrerequisite" | "recommendedBefore" | "revisitAfter" | "coPractice"
  }>
  diagnostics: {
    contractVersion: "2.0"
    attemptCount: number
    finalStatus: "explicit_ready" | "explicit_failed" | "fallback_only" | "not_attempted" | "stale"
    usingInferredFallback: boolean
    phaseCount: number
    acceptedEdgeCount: number
    droppedEdgeCount: number
    unresolvedSkillRefCount: number
  }
}
```

## Validation & Invariants
- Only populated after successful parsing, schema validation, and semantic validation.
- Every `nodeId` maps back to a valid node in the curriculum.
