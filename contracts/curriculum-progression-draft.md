# Contract: Curriculum Progression Draft

- **Status:** Active
- **Canonical Artifact Name:** CurriculumProgressionDraft
- **Current Version:** 2.0

## Purpose
Defines the only valid model output shape for progression generation. It strictly uses `skillRef` for linkage, eliminating title-based or hybrid matching.

## Producers
- **Entrypoints:** The AI model responding to the progression generation prompt.

## Consumers
- **Entrypoints:** `lib/curriculum/ai-draft.ts` (Parser) and `lib/curriculum/progression-validation.ts`.

## Persistence
- **Storage Location:** Raw attempt responses may be stored in DB progression state metadata for telemetry and debugging.

## Field Definitions

```typescript
{
  "progression": {
    "phases": [
      {
        "title": "string",
        "description": "string optional",
        "skillRefs": ["skill_ref_1", "skill_ref_2"]
      }
    ],
    "edges": [
      {
        "fromSkillRef": "skill_ref_a",
        "toSkillRef": "skill_ref_b",
        "kind": "hardPrerequisite" | "recommendedBefore" | "revisitAfter" | "coPractice"
      }
    ]
  }
}
```

## Hard Rules
- Output refs only, not titles.
- Every `skillRef` must come from the provided skill catalog.
- Every skill must appear in exactly one phase.
- No duplicate phase assignment.
- No self-loops.
- `hardPrerequisite` edges must be acyclic.
- `revisitAfter` and `coPractice` may be cyclic.
- No markdown fences in the parsed output.
- JSON object only.
