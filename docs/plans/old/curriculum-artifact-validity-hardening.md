# Curriculum Artifact Validity Hardening

## What Changed
- Removed synthetic final-artifact fallback behavior from curriculum generation and revision flows.
- Added explicit structured failure results for generation and revision.
- Tightened topic extraction so titles and labels use a short subject phrase instead of the full user request.
- Added hard validation for source titles and node labels before persistence.
- Normalized valid labels into cleaner subject/skill labels, while rejecting deeply malformed ones.
- Kept intake/chat fallback question behavior intact because it does not persist curriculum state.

## Why Final Artifact Fallback Was Removed
- A persisted curriculum must come from valid model output or a supported deterministic transform.
- Silent synthesis made it impossible to tell whether a curriculum reflected the model, a repair step, or an invented structure.
- Structured failures make the failure mode visible to callers and to logs before anything is written to storage.

## How Structured Failure Handling Works
- Generation returns either:
  - `success` with a valid artifact, or
  - `failure` with `stage`, `reason`, `userSafeMessage`, `issues`, `attemptCount`, `retryable`, and optional `debugMetadata`.
- Revision returns either:
  - `applied`,
  - `clarify`, or
  - `failure`.
- Persistence only happens after success or applied revision results.
- If the model output fails parsing, schema validation, naming validation, or quality validation, the pipeline returns a failure result instead of fabricating content.

## How Topic Extraction and Naming Behave Now
- Topic extraction aims for the actual subject of study, not the full conversational request.
- Titles may stay close to the requested subject when the subject is already clean and concise.
- Titles and labels are normalized to remove wrapper noise.
- Labels that look like sentence fragments, long request paraphrases, or wrapper phrases are rejected before persistence.

## How Callers Should Handle Results
- Generation callers should branch on `success` vs `failure`.
- Revision callers should branch on `applied`, `clarify`, vs `failure`.
- UI code should show the user-safe failure message when a failure result is returned.
- No caller should assume a curriculum artifact exists unless the result explicitly says so.

## Remaining Limits / Next Step
- The operational schema still stays at `domain -> strand -> goal_group -> skill`.
- Richer structure is preserved in metadata/source payload, but not yet promoted into first-class tree depth.
- Next recommended step: add a migration path that can reconstruct richer imported structure from preserved metadata when the schema is ready to expand.
