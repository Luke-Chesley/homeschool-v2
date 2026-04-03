# Platform Expansion Status

## Execution Context

- Umbrella branch: `feat/platform-expansion-exec`
- Umbrella worktree: `/home/luke/Desktop/homeschool-v2/.worktrees/platform-expansion-exec`
- Canonical main checkout: `/home/luke/Desktop/homeschool-v2`
- Status owner: Codex
- Last updated: 2026-04-03

## Objective

Implement the platform expansion plan end-to-end without doing a broad rename pass first. Preserve homeschool as the default template while generalizing through shared contracts, configuration, and durable workflow primitives.

## Current-State Audit

### Already durable or substantially implemented

- Organizations, learners, curriculum sources/items, weekly route items, learner skill states, interactive activities, attempts, progress records, observations, conversations, recommendations, and route overrides already have Drizzle-backed schema.
- Curriculum normalization/import and weekly route generation are database-backed.
- Phase 0 contract tables are now in the branch:
  - `organization_platform_settings`
  - generalized framework/objective fields on standards tables
  - generalized session workspace fields on `lesson_sessions`
  - evidence, feedback, and review queue primitives
  - prompt template and AI generation job tables
  - richer artifact lifecycle fields and progress-model fields
- Planning day and today execution now materialize durable `plan_items` and `lesson_sessions` through `lib/planning/service.ts`, `lib/planning/session-workspace-service.ts`, `lib/planning/today-service.ts`, and `lib/session-workspace/service.ts`.
- The learner activity runtime persists attempts, evidence, review queue entries, progress records, learner skill-state summaries, and durable recommendations.
- Prompt resolution is durable-first, async AI generation jobs are persisted, and generated artifacts are created with lineage-oriented metadata.
- Standards/objective browsing is API-backed in the branch instead of remaining client-side fixture state.

### Stubbed, mock-backed, or incomplete in core paths

- The local demo path still exists for empty-workspace fallback and fixture continuity. It no longer owns the main learner assignment path, but it is still present in `lib/db/fixtures/local-demo-persistence.ts`.
- Async AI execution is real in-process, but not yet moved to an external worker queue.
- Reporting/export remains preview-oriented and learner-scoped. There is still no full report-pack export/download pipeline.
- Permissions are still cookie/session-light. Role expansion exists at the enum/settings level, but route-level authorization is still shallow.
- Self-guided mode is now visible in the learner surface and org settings model, but does not yet have a separate end-to-end checkpoint policy engine.

### Highest-risk gaps against the plan

- Full role-aware permissions and review authorization remain open.
- Org-wide reporting packs and export delivery remain open.
- Activity assignment still needs broader coverage for more workflow-specific session types beyond the initial vertical template logic landed here.
- Lesson-plan generation still keeps a metadata fallback in addition to the new durable AI/artifact path; final artifact-first cleanup remains open.

## Phase Plan

## Phase 0: Foundation And Contracts

- Status: `in_progress`
- Branch: `feat/platform-expansion-exec`
- Blocking outputs:
  - platform terminology/configuration model
  - competency/objective model
  - generalized session workspace model
  - evidence/feedback/review primitives
  - artifact lifecycle and AI job persistence
  - migration-safe schema/repository updates
- Reconciliation notes:
  - This phase owns shared schema and repository contracts.
  - Later slices must consume these contracts rather than invent parallel models.
  - Implemented in this branch:
    - org-level platform settings and terminology defaults
    - generalized objective/framework fields
    - generalized session workspace fields and repositories
    - evidence, feedback, and review primitives
    - durable prompt template and AI job persistence
    - migration runner plus foundation SQL migration

## Stream A: Planning And Session Workspace

- Status: `in_progress`
- Branch: `feat/platform-expansion-exec`
- Ownership:
  - `lib/planning/**`
  - `lib/curriculum-routing/**`
  - `app/(parent)/planning/**`
  - `app/(parent)/today/**`
  - `components/planning/**`
- Dependencies:
  - Phase 0 session workspace contract
  - Phase 0 org/platform settings contract
- Implemented in this branch:
  - durable planning-day service replacing the mock-backed entry point
  - today workspace materialization into `plan_items` and `lesson_sessions`
  - durable completion flow through session/evidence/progress records
  - parent-side handoff into learner activity sessions from the today workspace
- Remaining blockers:
  - deeper partial-completion / replanning controls in the day and today UI
  - broader cohort/deadline pacing behaviors beyond current route-driven scheduling

## Stream B: Activity, Assessment, Evidence, And Review

- Status: `in_progress`
- Branch: `feat/platform-expansion-exec`
- Ownership:
  - `lib/activities/**`
  - `app/(learner)/**`
  - `app/api/activities/**`
  - `components/activities/**`
- Dependencies:
  - Phase 0 evidence/review contract
  - Phase 0 session workspace contract
- Implemented in this branch:
  - attempt records now bind to durable lesson-session identity
  - learner runtime writes evidence, progress, review queue items, and session completion updates
  - activity engine now supports `checklist`, `rubric_response`, `file_submission`, and `supervisor_sign_off`
  - assignment logic now varies by workflow mode instead of assuming one homeschool-only practice type
- Remaining blockers:
  - richer file upload/storage handling for `file_submission`
  - broader activity templating beyond the initial workflow-mode mapping

## Stream C: Tracking, Competencies, Progress, And Adaptation

- Status: `in_progress`
- Branch: `feat/platform-expansion-exec`
- Ownership:
  - `lib/tracking/**`
  - `lib/standards/**`
  - `lib/curriculum/learner-skill-*`
  - `app/(parent)/tracking/**`
  - `components/tracking/**`
- Dependencies:
  - Phase 0 competency/objective contract
  - Phase 0 evidence/feedback contract
- Implemented in this branch:
  - objective/framework service layer on top of the generalized standards tables
  - tracking dashboard reads durable evidence and review queue records
  - adaptation recommendations are persisted and can be accepted/overridden from tracking
  - tracking/reporting UI was reframed around objectives, evidence, review, and recommendations
- Remaining blockers:
  - generalized objective mapping beyond standards-derived nodes
  - org-wide reporting and pack export delivery

## Stream D: AI Platform, Artifacts, And Org Configuration

- Status: `in_progress`
- Branch: `feat/platform-expansion-exec`
- Ownership:
  - `lib/ai/**`
  - `lib/prompts/**`
  - `app/api/ai/**`
  - `lib/storage/**`
  - org/platform settings surfaces
- Dependencies:
  - Phase 0 org/platform settings contract
  - Phase 0 AI job and artifact lifecycle contract
- Implemented in this branch:
  - org platform settings defaults and label helpers
  - durable prompt template storage and seeding
  - durable AI job rows plus job-status API
  - generated artifact lineage fields and artifact creation during async generation
  - AI generation routes now use authenticated app-session context
- Remaining blockers:
  - external worker execution instead of in-process job handling
  - admin/settings UI for editing prompt and org platform settings

## Stream E: Permissions, Reporting Packs, And Self-Guided Mode

- Status: `partial`
- Branch: `feat/platform-expansion-exec`
- Ownership:
  - auth/permission layers
  - reporting/export layers
  - self-guided learner workflow surfaces
- Dependencies:
  - Phase 0 org/workflow configuration contract
  - Streams B and C for evidence and reporting primitives
- Implemented in this branch:
  - richer role enum groundwork (`coach`, `manager`, `reviewer`)
  - self-guided mode surfaced in learner UI copy and workflow-aware activity assignment
  - reporting UI now reflects review and recommendation state more directly
- Remaining blockers:
  - route-level permission enforcement
  - true report packs / downloads / multi-learner reporting
  - full self-guided checkpoint policy workflow

## Contract Decisions

### Platform terminology/configuration

- Decision target: add an org-scoped platform settings record instead of renaming internal tables.
- Status: `implemented`

### Competency/objective model

- Decision target: add generalized framework/objective tables and mapping rows while keeping standards tables intact for backward compatibility.
- Status: `implemented`

### Session workspace model

- Decision target: generalize execution through durable session workspace records and completion/review states while keeping existing planning/day flows stable.
- Status: `implemented`

### Evidence/feedback/review model

- Decision target: introduce first-class evidence, feedback, and review queue tables linked to sessions, activities, progress, and artifacts.
- Status: `implemented`

### Artifact and AI job lifecycle

- Decision target: add persistent prompt templates and AI jobs, then extend artifacts with richer lifecycle/lineage fields.
- Status: `implemented`

## Reconciliation Notes

- Delegation/sub-agents were used for bounded stream slices:
  - activity renderer/type expansion
  - tracking/reporting UI reframing
  - planning/tracking/AI audits for reconciliation notes
- The main checkout has a pre-existing `tsconfig.tsbuildinfo` modification. It is intentionally untouched.
- Existing weekly-route and curriculum-routing tables are already strong foundations. Phase 0 should extend them rather than replacing them.
- Existing lesson draft behavior stores generated markdown inside `plan_days.metadata`. This needs a durable artifact path, but the metadata fallback should remain during the transition so working flows are preserved.
- An extra duplicate migration file (`drizzle/0001_platform_expansion.sql`) was removed so the migration runner only sees the canonical foundation migration.

## Verification Log

- `http://localhost:3000` availability checked: `200 OK`
- Main checkout worktree state checked before execution.
- `corepack pnpm typecheck` run after foundation compile repair: pass
- `corepack pnpm typecheck` run after stream integration and delegated UI changes: pass
- Worktree server validated on `http://localhost:3002`
- Browser-validated routes:
  - `/today`
  - `/planning/day/2026-03-30`
  - `/tracking`
  - `/tracking/reports`
  - `/activity/session_2e0b5993572548408584d7a59e5f9de5`
  - `/copilot`
- `BASE_URL=http://localhost:3002 bash ./scripts/verify-before-merge.sh`: pass
- Reconciliation issue found during validation:
  - duplicate unique-key insertion on `plan_item_curriculum_links_weekly_item_idx` from concurrent today/session materialization
  - resolved by making both insertion paths idempotent with conflict handling and canonical link reuse
