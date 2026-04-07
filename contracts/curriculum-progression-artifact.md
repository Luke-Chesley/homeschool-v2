# Contract: Curriculum Progression Artifact

- **Status:** Active
- **Canonical Artifact Name:** CurriculumAiProgression
- **Current Version:** 1.0.0 (Prompt Version: `CURRICULUM_PROGRESSION_PROMPT_VERSION`)

## Purpose

The Curriculum Progression Artifact is the output of pass 2 (progression generation) in the two-pass curriculum pipeline. It defines an explicit global ordering for skills in the curriculum, expressed as learning phases (groups of skills at a similar stage) and directed dependency edges between individual skills.

The progression is used by the planner to determine which skills may be scheduled before others, and by the graph view to visualize the curriculum's prerequisite structure.

## Producers

- **Entrypoints:**
  - `generateCurriculumProgression()` in `lib/curriculum/ai-draft-service.ts` (initial generation, called from `generateCurriculumArtifact`)
  - `regenerateCurriculumProgression()` in `lib/curriculum/progression-regeneration.ts` (manual regeneration from existing DB state)
- **Canonical Source Files:**
  - `lib/prompts/curriculum-draft.ts` — system prompt (`CURRICULUM_PROGRESSION_SYSTEM_PROMPT`) and user prompt builder (`buildCurriculumProgressionPrompt`)
  - `lib/curriculum/ai-draft-service.ts` — generation loop, retry logic, attempt count tracking
  - `lib/curriculum/ai-draft.ts` — Zod schemas: `CurriculumAiProgressionSchema`, `CurriculumAiProgressionPhaseSchema`, `CurriculumAiProgressionEdgeSchema`

## Consumers

- **Entrypoints:**
  - `lib/curriculum/normalization.ts` — resolves skill refs (by ID then title), writes `curriculum_phases`, `curriculum_phase_nodes`, `curriculum_skill_prerequisites`
  - `lib/curriculum/progression-graph-model.ts` — builds the in-memory graph for the UI
  - `lib/curriculum/service.ts` — `getCurriculumProgression()` loads phases + edges from DB and surfaces diagnostics

## Persistence

- **Raw artifact:** Merged into `curriculum_sources.metadata` as `progression` before normalization.
- **Normalized storage:**
  - Phases → `curriculum_phases` table (one row per phase, ordered by `position`)
  - Phase memberships → `curriculum_phase_nodes` table (skill node → phase assignment)
  - Dependency edges → `curriculum_skill_prerequisites` table
- **State tracking:** `curriculum_progression_state` table — one row per source, tracks `status`, `attemptCount`, `lastFailureReason`, `lastAcceptedPhaseCount`, `lastAcceptedEdgeCount`, `provenance`, and `usingInferredFallback`

## Field Definitions

### Top-level wrapper

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `progression` | object | Yes | Container for phases and edges |
| `progression.phases` | array | Yes | Ordered list of learning phases |
| `progression.edges` | array | Yes | Directed dependency edges between skills |

### Phase object (`progression.phases[i]`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Human-readable phase name (e.g. "Foundations", "Intermediate") |
| `description` | string | No | Short explanation of what this phase represents |
| `skillTitles` | string[] | Yes | List of skill titles belonging to this phase. Must match leaf node titles exactly. |
| `skillIds` | string[] | No | Stable node IDs parallel to `skillTitles`. When present, ID-first resolution is used during normalization. |

### Edge object (`progression.edges[i]`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fromSkillTitle` | string | Yes | Title of the source skill. Must match a leaf node exactly. |
| `toSkillTitle` | string | Yes | Title of the target skill. Must match a leaf node exactly. |
| `fromSkillId` | string | No | Stable node ID for `fromSkillTitle`. Preferred over title when present. |
| `toSkillId` | string | No | Stable node ID for `toSkillTitle`. Preferred over title when present. |
| `kind` | enum | Yes | One of: `hardPrerequisite`, `recommendedBefore`, `revisitAfter`, `coPractice` |

### Edge kinds

| Kind | Semantics |
|------|-----------|
| `hardPrerequisite` | True gate — `toSkill` cannot be started until `fromSkill` is mastered. Must not form cycles. |
| `recommendedBefore` | Soft sequencing suggestion. Non-blocking. |
| `revisitAfter` | Intentional spaced-practice revisit: resurface `fromSkill` after `toSkill`. |
| `coPractice` | Skills that should be introduced or practiced together. |

## Validation & Invariants

- **Title matching:** All `skillTitles` in phases and edges MUST match leaf node titles in the curriculum document tree exactly (case-sensitive). Unresolved titles are dropped with a warning; unresolved counts are reported in diagnostics.
- **ID resolution:** When `skillIds` / `fromSkillId` / `toSkillId` are present and match active node IDs, they take precedence over title lookup. See `validateProgressionSemantics()` in `lib/curriculum/progression-validation.ts`.
- **Cycle detection:** `hardPrerequisite` edges MUST form a DAG (no cycles). Validation fails if a cycle is detected; the progression is rejected and retried.
- **Phase coverage:** Phases must collectively cover a meaningful fraction of the skill set to pass the coverage threshold in `validateProgressionSemantics`.
- **Schema validation:** The raw JSON is validated against `CurriculumAiProgressionSchema` (Zod) before semantic checks. Both must pass for the progression to be accepted.
- **Retry budget:** Up to 5 attempts are made. Attempts 4 and 5 use escalating correction notes requesting progressively simpler output (minimal safe structure on attempt 4; absolute simplest valid structure on attempt 5). If all attempts fail, the system falls back to inferred linear ordering.

## Retry Behavior

| Attempt | Strategy |
|---------|----------|
| 1–3 | Standard prompt; correction notes based on specific failure reason |
| 4 | Minimal safe output requested (few phases, few hard edges) |
| 5 | Absolute simplest valid structure: 2 phases, 1–3 edges |

Attempt count is persisted in `curriculum_progression_state.attempt_count`.

## Skill Reference Strategy

### Initial generation path
Skills are referenced by title only (IDs not yet available during pass 2 of first import). Normalization resolves titles to stable node IDs (`cnode_` prefix, SHA-256 of `sourceLineageId:normalizedType:normalizedPath`).

### Regeneration path
DB node IDs are loaded and passed as `skillRefs: {skillId, skillTitle}[]`. The prompt lists skills with both ID and title; the model is instructed to output IDs in edges and phase assignments. Normalization resolves by ID first, title as fallback.

## Fallback

If all generation attempts fail, the system falls back to inferred canonical order (document tree traversal order). Fallback does not use this artifact — it is derived entirely from the curriculum node hierarchy. The progression state is set to `fallback_only` or `explicit_failed` accordingly. The DiagnosticsBar in the graph view shows actionable messaging and a "Regenerate progression" button for recovery.

## Ownership & Lifecycle

- **Owner:** Curriculum Source → Household → Organization
- **Provenance values:** `initial_generation`, `manual_regeneration`, `fallback_inference`
- **Status values:** `not_attempted`, `explicit_ready`, `explicit_failed`, `fallback_only`, `stale`
- **Stale detection:** `stale` status is defined but not yet auto-set on curriculum core update (see known gaps).

## Change Impact

- Changes to edge kinds affect the planner's route generation logic.
- Changes to phase structure affect the graph view's column layout.
- Prompt changes must bump `CURRICULUM_PROGRESSION_PROMPT_VERSION` in `lib/prompts/curriculum-draft.ts`.
- Schema changes to `CurriculumAiProgressionSchema` in `lib/curriculum/ai-draft.ts` must be reflected here.

## Known Gaps / TODOs

- **Stale auto-detection:** The `stale` status is not automatically set when the curriculum core is updated. A future pass should mark progression stale when `importNormalizedTree` detects a changed source fingerprint.
- **Initial generation skill IDs:** The initial generation path still uses title-only prompting because source IDs don't exist when pass 2 runs. Passing a pre-created source ID would allow ID-first prompting on first import.
- **Legacy sources:** Sources created before migration 0006 have no `curriculum_progression_state` row. State is inferred from DB presence on read.

## Related Contracts

- `curriculum-artifact.md` — the parent artifact that includes progression as an optional field
- `curriculum-revision-artifact.md` — revision path that also triggers a progression pass
