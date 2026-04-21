# Homeschool Workspace Full Implementation Plan

> Status: broad implementation plan and future-state inventory.
> This document intentionally mixes ideas beyond the current homeschool beta, including broader platform shape, future Copilot behavior, and older runtime assumptions.
> For the current operational architecture, use [CURRENT_PRODUCT_AND_RUNTIME_MODEL.md](./CURRENT_PRODUCT_AND_RUNTIME_MODEL.md).

## Summary

Build a multi-tenant AI-assisted homeschool workspace with two connected product surfaces:

- Parent workspace for planning, curriculum management, pacing, tracking, standards coverage, reporting, and AI-assisted adjustments.
- Learner activity surface for interactive worksheets, practice apps, guided exercises, and lesson-specific learning experiences.

The system should center on the lifecycle of a lesson: curriculum becomes planned work, planned work becomes generated content and interactive activities, completed work becomes tracking data, and tracking data feeds AI analysis to improve future plans.

This is not an MVP plan. The full product is in scope, but implementation should still be sequenced into parallelizable workstreams.

## Tech Stack

- App framework: Next.js App Router + React 19 + TypeScript
- UI: Tailwind CSS v4 + local `shadcn/ui` component layer
- Auth / tenancy / storage / DB: local Supabase stack in development and hosted Supabase later for Auth, Postgres, and Storage
- ORM / schema / migrations: Drizzle ORM
- Async orchestration: Inngest for all non-trivial AI and document-processing jobs
- AI runtime: provider-agnostic AI service layer with task-based adapters; use the Vercel AI SDK for streaming chat UX and provider abstraction at the request layer
- AI providers: provider-agnostic core, with routing/config stored in DB so models can be swapped per task
- Search / retrieval: Postgres + `pgvector` for curriculum chunks, standards text, prior artifacts, and chat retrieval
- Document ingestion: Supabase Storage uploads + background extraction/chunking pipeline for PDF, DOCX, pasted text, and structured curriculum entry
- Hosting: local development runs Next.js + local Supabase + Inngest; production runs Vercel + hosted Supabase
- Observability: structured app logs, job logs, artifact/version audit trail, prompt/version metadata, and basic product analytics

## Core Product Model

Use one top-level `Organization` model so the system is broad-org ready without duplicating household logic. Organization types: `household`, `tutor_practice`, `co_op`, `school_like`. Adult memberships carry roles such as `owner`, `admin`, `educator`, `observer`. Learners belong to one organization.

Core entities:

- `Organization`, `Membership`, `AdultUser`
- `Learner`, `LearnerProfile`, `LearningGoal`
- `StandardFramework`, `StandardNode`, `GoalMapping`
- `CurriculumSource`, `CurriculumAsset`, `CurriculumItem`
- `Plan`, `PlanWeek`, `PlanDay`, `PlanItem`
- `LessonSession` as the execution record for a planned lesson on a real day
- `GeneratedArtifact` for lesson plans, explanations, worksheets, quizzes, rubrics, extensions, simplified versions
- `InteractiveActivity` for learner-facing experiences
- `ActivityAttempt`, `ProgressRecord`, `ObservationNote`
- `ConversationThread`, `ConversationMessage`, `CopilotAction`
- `AdaptationInsight` and `Recommendation`

Important public/domain interfaces:

- Planning input: learner profile + curriculum items + schedule constraints + standards/goals + pacing preferences
- Planning output: dated plan items linked to standards, estimated effort, suggested resources, and generation affordances
- Artifact output: versioned artifact records with source context, prompt/version metadata, status, and edit history
- Interactive output: schema-backed activity definition plus rendering config and attempt tracking
- Tracking output: completion status, time spent, mastery signal, parent notes, standards coverage delta, and adaptation signals

## Main Use Cases and Separation

### Planning

For the parent workspace.

- Create learners, goals, schedules, constraints, and preferences
- Import curriculum or draft it with AI
- Convert curriculum into units, lessons, pacing, weekly plans, and daily plans
- Re-plan when lessons are skipped, compressed, or expanded
- Analyze how lessons went and apply that to future planning

### Content Generation

For lesson preparation and adjustment.

- Generate lesson drafts, explanations, printable worksheets, quizzes, prompts, extension activities, remediation variants, and differentiated versions
- Keep every generated asset editable, versioned, and linked back to its lesson context
- Never treat generated text as the sole source of truth; lesson and tracking objects remain canonical

### Interactive Learning

For the learner surface.

Use a hybrid engine:

- Primary mode: structured activity types with bounded schemas such as quiz, matching, flashcards, drag/drop sequencing, guided practice, reflection, reading-check, and simple simulation templates
- Advanced mode: richer custom activity compositions built from an allowlisted component registry and JSON layout schema
- Do not allow arbitrary AI-generated executable code to run as learner content

Every interactive activity must be:

- derived from a lesson or standard/goal
- renderable from stored schema
- resumable
- attempt-tracked
- reportable back into planning/tracking

### Tracking and Compliance

For accountability and reporting.

- Record what was planned, what happened, what was changed, and why
- Map lessons and activities to standards and custom goals
- Show coverage, gaps, completion history, and evidence artifacts
- Support exports for parent records and org reporting
- Implement structured standards mapping, not a full rules engine for state compliance logic

### AI Copilot

The glue across both surfaces.

- Persistent context-aware chat panel scoped to organization, learner, lesson, plan day, curriculum, standards, and prior progress
- Copilot actions can modify a plan, generate artifacts, create interactives, summarize a lesson, answer questions, or propose recovery options
- All meaningful chat outputs should land as structured actions/artifacts, not only freeform text

## System Behavior and Data Flow

- Upload/import curriculum into storage and structured records
- Background jobs extract text, chunk it, classify it, attach metadata, and optionally suggest standards mappings
- Planning engine creates or revises plan objects; all major plan revisions are versioned
- Parent opens a daily workspace that aggregates the day’s plan items, supporting artifacts, interactive activities, and copilot context
- Parent can request worksheet generation, lesson adaptation, simplification, extension, or interactive conversion; each request becomes an async job
- Learner completes interactive activities in learner mode; attempts and outcomes stream back into progress records
- Parent logs completion, notes, observations, and deviations
- Adaptation jobs analyze outcomes and propose future pacing, modality, difficulty, and scheduling changes
- Standards/goal coverage views update from both plan intent and actual completion evidence

## Implementation Changes

### Parent Workspace

Implement these major areas:

- Org/role-aware onboarding and learner setup
- Curriculum library with import, manual authoring, AI drafting, and standards linkage
- Planning workspace with weekly/day views, pacing controls, drag/reorder, and recovery planning
- Daily workspace as the operational hub for each lesson
- Tracking/reporting area with coverage, gaps, notes, exports, and audit history

### Learner Surface

Implement:

- session-safe learner mode for assigned activities
- activity player runtime for structured and hybrid interactive content
- progress/attempt capture with autosave and resume
- teacher/parent handoff back to tracking

### AI Platform Layer

Implement:

- task registry for planning, worksheet creation, lesson drafting, adaptation, summarization, standards suggestions, and chat answers
- provider-agnostic adapter interface with task-level model selection
- prompt/version storage, artifact lineage, and evaluation metadata
- streaming chat for conversational UX and async jobs for long-running generation

### Planning and Adaptation Engine

Implement:

- deterministic planning rules for calendars, pacing, constraints, prerequisites, and carryover
- AI-assisted recommendation layer on top of deterministic rules
- post-lesson analysis that converts notes, completion patterns, and activity outcomes into future plan recommendations
- recommendation acceptance flow so parent remains in control

## Parallel Delivery Workstreams

### Foundation and tenancy

- auth, organizations, roles, learners, storage, base schema, audit model

### Curriculum and standards

- curriculum ingest, structured curriculum tree, standards catalogs, mappings, retrieval indexing

### Planning and daily workspace

- planning engine, plan views, day execution surface, lesson session model

### Generation pipeline

- artifact jobs, versioning, editing, regeneration, lineage, source context

### Interactive engine

- activity schemas, renderer registry, learner mode, attempts, grading/mastery signals

### Tracking and reporting

- completion records, observations, standards coverage, exports, gap analysis

### Copilot and adaptation

- context assembly, chat actions, lesson analysis, future-plan recommendations

### Hardening

- permissions, observability, prompt governance, moderation, cost controls, backup/export flows

## Test Plan

- Create multiple org types and verify permissions, learner ownership, and educator access boundaries
- Import curriculum from upload, paste, and manual entry; confirm structured items and retrieval chunks are created
- Generate plans with constraints, then re-plan after skipped/completed/overrun lessons
- Generate artifacts and confirm async status flow, version history, editability, and lineage
- Render interactive activities from stored schemas and persist attempts/resume correctly
- Verify lesson completion updates standards/goals coverage and downstream reports
- Confirm copilot can act on the current lesson/day context without losing structured outputs
- Validate adaptation recommendations after low completion, high mastery, repeated skips, and changed schedules
- Test provider abstraction by switching task routing without changing product behavior
- Test export/report scenarios for household and org-style tenants

## Assumptions and Defaults

- The repository should continue aligning with the existing Next.js + Supabase + Drizzle + Inngest architecture
- Local-first development means running Supabase locally, not using SQLite
- Scope is full-product, but delivery is still phased for engineering practicality
- Standards support is first-class and structured, but this plan does not include a state-specific compliance rules engine
- Interactive learning uses a hybrid schema-driven engine, not arbitrary AI-generated executable apps
- Parent control is preserved: AI proposes and generates, but user approval/editability remains central
- Environment switching between local Supabase and hosted Supabase should be configuration-driven rather than requiring domain-model rewrites
