# Progression Contract Rewrite

## Why title+id hybrid output was removed
The progression generation prompt previously asked the model to output both the `skillTitle` and the `skillId` for every node referenced in a phase or edge. This was problematic because:
1. It required generating twice the amount of metadata per node.
2. It opened the door to inconsistencies where the model would output a title but hallucinate or mismatch the ID.
3. Weak or local models struggled to adhere to the strict output shape while maintaining pedagogical coherence.

## Why skillRef exists
We introduced `skillRef` as the singular deterministic linkage key. A `skillRef` is a short, machine-safe string that is:
- Unique within a curriculum.
- Reproducible before DB insert (so we don't have to wait for `nodeId` assignments during initial generation).
- Derivable again during regeneration.
- Completely independent of the model's output wording, ensuring a clean separation between the display title and the logical edge linkage.

## Why initial generation and regeneration now share one contract
Previously, initial generation relied on string titles while regeneration introduced DB node IDs. This meant the model was being trained/prompted to understand two different conceptual schemas for what is fundamentally the same task. By adopting `skillRef`, both the initial generation pass and the regeneration pass can populate the `skillCatalog` with deterministic refs. The prompt structure, system instructions, and response parsing are exactly the same in both scenarios. 

## Why attempt-level diagnostics were added
Previously, any failure—whether it was a network timeout, a JSON syntax error, a schema mismatch, or a cyclic dependency graph—was collapsed into a generic "model call failed" bucket or silently returned no content. We introduced a `ProgressionAttemptResult` interface that tracks the exact failure category (transport, parse, schema, semantic) on an attempt-by-attempt basis. This is persisted to the progression state metadata and surfaced directly in the UI via the `CurriculumProgressionViewModel`, making it much easier to debug weak models.

## What fallback means in the new system
If the model fails repeatedly (e.g. consistently generates a cycle or fails schema checks after 5 attempts), the system explicitly flags the state as `fallback_only` and records the exact reason the last attempt failed. Instead of leaving the graph empty or masking the failure, it constructs an inferred canonical order using `inferred` edges. The UI is aware of this fallback state through the `CurriculumProgressionViewModel` and explicitly warns the user that the ordering is inferred and can be regenerated.
