# Progression State and Regeneration

## Why progression absence is now first-class

Previously, progression failure was silent. The system would attempt to generate a progression graph and, if it failed, fall back to inferred canonical order with no visible record of the attempt. The `curriculum_phases` table being empty was the only indication, and nothing distinguished "generation was never attempted" from "generation failed" from "generation succeeded but was incomplete."

This created a debugging dead end: the planner ran on fallback ordering, the graph showed a fallback column, and there was no recovery path without a full re-import.

The fix: a dedicated `curriculum_progression_state` table with one row per source tracks:
- **status**: `not_attempted | explicit_ready | explicit_failed | fallback_only | stale`
- **lastAttemptAt** / **attemptCount** / **lastFailureReason**: what happened on the last run
- **lastAcceptedPhaseCount** / **lastAcceptedEdgeCount**: what was accepted if successful
- **usingInferredFallback**: whether the planner is currently on fallback
- **provenance**: `initial_generation | manual_regeneration | fallback_inference`

The `getCurriculumProgression()` service function now loads this row and exposes these fields through `CurriculumProgressionDiagnostics`. The graph UI reflects the actual state.

## Critical bug fixed: progression was never persisted

`importNormalizedTree()` was calling `normalizeCurriculumDocument()` without passing `imported.progression`. This meant all AI-generated progressions were silently discarded during the import step — phases and explicit prerequisites were never written to DB. The system always fell back to inferred ordering even when the AI had generated a valid progression. This is now fixed.

## Why retries were increased to 5

Two attempts was insufficient for a non-trivial curriculum tree where the model needed to:
1. Match all skill titles exactly
2. Avoid prerequisite cycles
3. Assign enough skills to phases to pass the coverage threshold

5 attempts provides a reasonable budget while still being bounded. Each attempt from 3 onwards escalates with more specific correction notes — attempt 4 requests a minimal safe output and attempt 5 requests the absolute simplest valid structure (2 phases, 1–3 edges).

Attempt count is now logged and stored in the progression state, making it easy to identify curricula that required many retries.

## How manual regeneration works

`regenerateCurriculumProgression()` in `lib/curriculum/progression-regeneration.ts`:

1. Loads the source and all active skill nodes from DB
2. Builds `skillRefs: {skillId, skillTitle}[]` from the DB nodes (stable IDs, no title guessing)
3. Calls `generateCurriculumProgression()` with the skill refs — the prompt includes both IDs and titles
4. If valid, clears `curriculum_phases`, `curriculum_phase_nodes`, and `curriculum_skill_prerequisites` for the source and writes the new result
5. Updates `curriculum_progression_state` with the outcome and `provenance = "manual_regeneration"`

The regeneration is exposed as a server action in `app/(parent)/curriculum/graph/actions.ts` and wired to a "Regenerate progression" button in the graph view's diagnostics bar.

## How fallback messaging changed

`DiagnosticsBar` in the graph view now maps `progressionStatus` to actionable messages:

| Status | Message shown |
|---|---|
| `explicit_ready` | "Explicit progression" |
| `explicit_failed` | "Explicit progression unavailable — generation failed. Last failure: …" |
| `fallback_only` | "Explicit progression was not accepted during generation. Using inferred fallback. Regenerate progression to replace fallback ordering." |
| `stale` | "Explicit progression exists but is stale. Curriculum was updated since last progression generation." |
| `not_attempted` | "Progression not yet generated." |

The regeneration button is always visible in the status bar so recovery is one click away.

## How the system is moving from title refs to stable skill IDs

The current progression generation (pass 2) has always referenced skills by title. This caused silent data loss when titles drifted between generation and normalization.

Migration approach:
- `CurriculumAiProgressionEdgeSchema` now has optional `fromSkillId` / `toSkillId` fields
- `CurriculumAiProgressionPhaseSchema` now has an optional `skillIds` array parallel to `skillTitles`
- `buildCurriculumProgressionPrompt()` accepts a `skillRefs?: {skillId, skillTitle}[]` parameter; when provided, the prompt lists skills with both ID and title and instructs the model to output IDs in edges and phase assignments
- `validateProgressionSemantics()` accepts an optional `skillIdToTitle` map; when provided, ID-based resolution takes priority over title matching
- `normalizeCurriculumDocument()` resolves edges and phase memberships by stable ID first, then falls back to title lookup

For the **initial generation path**: skill IDs are not yet available (the source record doesn't exist when pass 2 runs), so the prompt still uses titles only. This will be addressed when pre-computed deterministic IDs are made available before the source record is created.

For the **regeneration path**: DB node IDs are loaded and passed as `skillRefs`, making the regeneration ID-first and title-drift-immune.

## Remaining migration limitations

1. **Initial generation still uses titles**: The stable node ID is derived from `sha256(sourceLineageId:normalizedType:normalizedPath)`, which requires the source ID to exist. The source is created before `importNormalizedTree` is called, but after `generateCurriculumArtifact`. Passing the pre-created source ID to the progression generation step would allow ID-based prompting on first import; this work is not done yet.

2. **`stale` status not auto-detected**: The `stale` state is defined but not automatically set when the curriculum core is updated. A future pass should set the progression state to `stale` when `importNormalizedTree` runs and finds that the source fingerprint has changed since the last progression was accepted.

3. **Old curricula have no state row**: Existing sources created before this migration have no `curriculum_progression_state` row. `getCurriculumProgression()` infers state from DB presence (phases exist → `explicit_ready`, inferred prerequisites exist → `fallback_only`), so these sources still display correctly, but the attempt count and failure reason will be null until a regeneration is run.
