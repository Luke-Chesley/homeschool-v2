# Curriculum Granularity Hardening

## What Changed
- Replaced the generic curriculum fallback with topic-aware, learner-adaptive fallback generation.
- Removed hard-coded chess-specific fallback branches from the curriculum pipeline.
- Shifted the generation prompt away from compactness pressure and toward teachable granularity.
- Added a rule-based curriculum QA layer for atomicity, learner-fit granularity, teachability, assessment visibility, practice/review/application balance, and lesson-to-skill alignment.
- Preserved deeper imported source structure in `sourcePayload` and `metadata` instead of flattening it away.

## Why the 4-Level Canonical Model Stayed
- The operational model still needs to stay stable for scheduling, planning, and UI assumptions.
- The app currently expects `domain -> strand -> goal_group -> skill`, so this change kept the canonical shape intact instead of opening arbitrary tree depth.
- The new work improves instructional quality without forcing a schema migration.

## How Future Flexibility Is Preserved
- Raw container paths, raw paths, and compression metadata now survive normalization.
- When a goal group compresses deeper imported structure, the lineage is retained in metadata so a richer schema can be reconstructed later.
- The fallback builder now uses topic- and learner-aware heuristics rather than hard-coded subject branches, which keeps the code adaptable without widening the core schema yet.

## What the QA Layer Catches
- Skills that bundle multiple distinct procedures, rules, or misconception targets into one node.
- Curricula that are too broad for the requested pacing or learner readiness.
- Lesson sequences that do not show visible progress checks.
- Lesson plans that fail to balance practice, review, and application.
- Lesson-to-skill links that do not match the actual instructional granularity.

## Remaining Limits
- The schema still only supports the four canonical levels.
- Imported trees deeper than that are preserved in metadata, but not yet surfaced as first-class operational nodes.
- The fallback planner is heuristic-based and will still need review on unusual topics or sparse intake data.

## Next Recommended Step
- If the curriculum graph needs to become more expressive, introduce a migration path from compressed metadata into richer first-class structures while keeping the current canonical model as the compatibility layer.
