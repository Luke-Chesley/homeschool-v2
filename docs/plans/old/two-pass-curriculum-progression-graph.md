# Implementation Note: Two-Pass Curriculum Progression Graph

## Context
The previous curriculum planning model relied on "weak inferred predecessor ordering" derived from the flattened leaf order of the curriculum tree. While this provided a basic sequence, it often felt loose or random because it didn't capture real pedagogical dependencies, phases, or complex relationships like revisits and co-practice.

## Goal
To implement a first-class global progression model that allows for robust, sequence-aware planning while keeping the curriculum artifact coherent and teachable.

## Architecture: Two-Pass Generation
Curriculum generation and revision are now split into two internal reasoning passes:

1. **Pass 1: Core Structure**
   - Generates the curriculum tree (document), pacing, and lesson outline (units).
   - Focused on structural organization and instructional volume.
   - Prompt: `curriculum.generate.core`

2. **Pass 2: Progression Reconciliation**
   - Takes the core structure from Pass 1 and reasons over its pedagogical flow.
   - Generates learning phases (bands) and explicit dependency edges.
   - Prompt: `curriculum.generate.progression`

The two outputs are merged into a single `CurriculumAiGeneratedArtifact` before being returned to the system.

## Progression Model
The progression model is separate from the hierarchical document tree:

- **Phases**: Learning bands that group skills into meaningful stages (e.g., "Foundations", "Application", "Advanced Mastery").
- **Edge Kinds**:
  - `hardPrerequisite`: Strict eligibility gate.
  - `recommendedBefore`: Soft sequencing suggestion.
  - `revisitAfter`: Intentional reinforcement/spaced practice.
  - `coPractice`: Simultaneous or interleaved introduction.

## Operational Persistence
The progression data is persisted into specialized tables:
- `curriculum_phases` & `curriculum_phase_nodes`: Operational phase membership.
- `curriculum_skill_prerequisites`: Stores all edge types, using the `kind` column to distinguish them.

## Planner Integration
The weekly route generator (`lib/curriculum-routing/service.ts`) has been rewritten to be progression-aware:
1. **Hard Gates**: Skills are filtered out if their `hardPrerequisite` edges are unsatisfied.
2. **Phase Prioritization**: The planner prioritizes skills from the earliest active phases.
3. **Soft Sequence Ranking**: Within phases, `recommendedBefore`, `revisitAfter`, and `coPractice` edges influence the ranking of recommended skills.
4. **Tie-Breaking**: Branch weighting and local tree order are used as secondary ordering signals.

## Repair & Conflict Logic
Repair logic now distinguishes between hard and soft conflicts:
- `hardPrerequisite` conflicts are treated as blocking errors.
- `recommendedBefore` conflicts are treated as soft warnings that can be overridden by the parent.

## Limitations & Next Steps
- **Revisit Frequency**: The system currently identifies `revisitAfter` relationships, but the specific timing and frequency of spaced practice are handled by the planner's local heuristics.
- **Manual Phase Edits**: Currently, phases are AI-generated; future work should allow parents to manually adjust phase membership in the UI.
- **Cycle Detection**: While the AI is instructed to avoid cycles, the normalization layer enforces hard prerequisite acyclicity during import.
