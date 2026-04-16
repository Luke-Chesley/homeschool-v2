# learning-core Split Plan

## Goal

Move AI runtime concerns out of `homeschool-v2` and into a separate Python service called `learning-core`.

## Current Boundary

- `learning-core` owns:
  - skill registry
  - `SKILL.md` prompts
  - provider/runtime selection
  - typed artifact production
  - prompt preview generation
  - execution traces and lineage
- `homeschool-v2` owns:
  - UI and routes
  - auth and app session
  - product DB schema and repositories
  - persistence of generated artifacts
  - learner runtime, attempts, evidence, and tracking

## New Repo Tree

```text
/home/luke/Desktop/learning/learning-core
  README.md
  pyproject.toml
  learning_core/
    api/
      app.py
    contracts/
      activity.py
      curriculum.py
      evaluation.py
      lesson_draft.py
      progression.py
      session_plan.py
    observability/
      traces.py
    runtime/
      context.py
      engine.py
      errors.py
      policy.py
      providers.py
      registry.py
      skill.py
      tooling.py
    skills/
      activity_generate/
        SKILL.md
        policy.py
        schemas.py
        skill.py
        tooling.py
        examples/request.json
      curriculum_generate/SKILL.md
      curriculum_revise/SKILL.md
      progression_generate/SKILL.md
      progression_revise/SKILL.md
      session_generate/SKILL.md
      session_evaluate/SKILL.md
      curriculum_update_propose/SKILL.md
  tests/
```

## Runtime Interfaces

- `learning_core.runtime.policy.ExecutionPolicy`
  - declares skill version, temperature, token cap, allowed tools, and attempts
- `learning_core.runtime.context.RuntimeContext`
  - request id and execution timestamp for each operation call
- `learning_core.runtime.tooling.ToolRegistry`
  - allowlisted tool resolution; unknown tools fail immediately
- `learning_core.runtime.registry.SkillRegistry`
  - forced operation-name to skill resolution
- `learning_core.runtime.engine.AgentEngine`
  - validates input, builds prompt preview, selects provider, executes structured output, and returns lineage/trace
- `learning_core.runtime.skill.SkillDefinition`
  - per-skill contract for prompt preview and execution

## Main Artifact Schemas

- `ActivityArtifact`
  - first fully implemented typed artifact for this split
  - matches app-side `ActivitySpec` shape at the HTTP boundary
- `StructuredLessonDraft`
  - canonical lesson-draft input contract for activity/session generation
- `CurriculumArtifact`
  - scaffolded contract for curriculum generation/revision
- `ProgressionArtifact`
  - scaffolded contract for progression generation/revision
- `SessionPlanArtifact`
  - scaffolded contract for daily session planning
- `EvaluationArtifact`
  - scaffolded contract for session evaluation
- `CurriculumUpdateProposalArtifact`
  - scaffolded contract for post-evaluation update proposals

## Operations

- `generate-curriculum-from-scratch`
- `revise-existing-curriculum`
- `generate-progression-model`
- `revise-progression-model`
- `generate-daily-session-plan`
- `generate-activities-from-plan-session`
- `evaluate-completed-session`
- `propose-curriculum-progression-updates`

Seven are explicit fail-fast stubs. Activity generation is implemented end to end.

## First Implementation Pass

### What moved for activities

- Prompt source moved from `homeschool-v2` into:
  - `/home/luke/Desktop/learning/learning-core/learning_core/skills/activity_generate/SKILL.md`
- Runtime execution moved from in-repo TS generation service into:
  - `/home/luke/Desktop/learning/learning-core/learning_core/runtime/*`
  - `/home/luke/Desktop/learning/learning-core/learning_core/api/app.py`
- App boundary now goes through:
  - `lib/learning-core/client.ts`
  - `lib/learning-core/activity.ts`

### What was deleted from `homeschool-v2`

- `lib/prompts/activity-spec.ts`
- `lib/activities/generation-context.ts`
- `lib/activities/generation-service.ts`

### What stayed in `homeschool-v2`

- `lib/activities/spec.ts`
- `lib/activities/validation.ts`
- `lib/activities/assignment-service.ts`
- learner renderers and attempt flow
- tracking, evidence, and persistence repos

The app still validates returned `ActivitySpec` artifacts locally and rejects warnings as hard boundary failures.

## Exact Modules To Move Next

### From `lib/ai/`

- `lib/ai/task-service.ts`
- `lib/ai/types.ts`
- `lib/ai/provider-adapter.ts`
- `lib/ai/registry.ts`
- `lib/ai/routing.ts`
- `lib/ai/anthropic-adapter.ts`
- `lib/ai/ollama-adapter.ts`
- `lib/ai/mock-adapter.ts`

### From curriculum AI

- `lib/curriculum/ai-draft.ts`
- `lib/curriculum/ai-draft-service.ts`
- `lib/curriculum/revision-model.ts`
- `lib/curriculum/progression-validation.ts`
- `lib/curriculum/progression-sanitization.ts`
- `lib/curriculum/progression-repair.ts`
- `lib/curriculum/progression-regeneration.ts`

### API routes that should become thin adapters or be removed

- `app/api/ai/generate/route.ts`
- `app/api/ai/jobs/[jobId]/route.ts`
- `app/api/ai/lesson-plan/route.ts`
- `app/api/curriculum/ai-draft/route.ts`
- `app/api/curriculum/ai-draft/chat/route.ts`
- `app/api/curriculum/sources/[sourceId]/ai-revise/route.ts`

## Removal Plan

1. Finish activity-generation hardening and run it only through `learning-core`.
2. Replace lesson-plan generation with a `learning-core` session-planning operation.
3. Replace session evaluation proposal logic with a `learning-core` evaluation operation.
4. Replace curriculum/progression generation and revision routes with thin adapters.
5. Delete `lib/prompts/*` and `lib/ai/*` modules once nothing calls them.
6. Remove prompt-template DB usage after prompt ownership fully leaves the app.
7. Remove remaining legacy v1 activity compatibility once old persisted records are migrated or explicitly dropped.

## Test Plan

### `learning-core`

- `python3 -m compileall learning_core tests`
- `pytest` once deps are installed
- add provider-backed integration tests later for Anthropic/Ollama

### `homeschool-v2`

- `corepack pnpm typecheck`
- `corepack pnpm test:activity`
- browser validation of the today activity-generate flow after `learning-core` is running

## Local Dev Topology

- `homeschool-v2`: `http://localhost:3000`
- `learning-core`: `http://127.0.0.1:8000`

The app no longer owns local prompt execution for extracted activity generation. If `learning-core` is down or misconfigured, the feature should fail immediately.
