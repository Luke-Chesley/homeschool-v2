# Contract: Curriculum Progression Generation Input

- **Status:** Active
- **Canonical Artifact Name:** CurriculumProgressionGenerationInput
- **Current Version:** 2.0

## Purpose
Defines the exact shape of the input sent to the LLM to generate a curriculum progression graph. It provides a compact skill catalog with deterministic `skillRef` identifiers and context about the curriculum.

## Producers
- **Entrypoints:** `lib/curriculum/ai-draft-service.ts` (or similar service generating the prompt)
- **Canonical Source Files:** `lib/prompts/curriculum-draft.ts`

## Consumers
- **Entrypoints:** The AI adapter/model that processes the prompt.

## Persistence
- **Storage Location:** Transient (sent as prompt input), but may be stored in `debug.promptInput` in the UI view model for debugging.

## Field Definitions

```typescript
type CurriculumProgressionGenerationInput = {
  contractVersion: "2.0"
  source: {
    title: string
    summary?: string
    learnerDisplayName?: string
  }
  curriculumSummary?: {
    description?: string
    pacingSummary?: string
  }
  skillCatalog: Array<{
    skillRef: string
    title: string
    domainTitle?: string
    strandTitle?: string
    goalGroupTitle?: string
    ordinal?: number
  }>
  optionalPlanningHints?: {
    lessonDurationMinutes?: number | null
    unitTitles?: string[]
  }
}
```

## Rules & Constraints
- `skillCatalog` is authoritative.
- `skillRef` is the canonical linkage key.
- Titles are for semantic understanding only.
- No current fallback prerequisites are passed.
- No diagnostics blob.
- Keep prompt context compact, avoid sending giant duplicated raw artifacts.
