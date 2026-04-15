# Phase 0 Implementation

## Goal

Lock the AI launch contract before changing intake, routing, generation, or mobile runtime behavior.

## Current Code Reality

- `components/onboarding/homeschool-onboarding-form.tsx` still assumes a text-first, route-first fast path.
- `lib/homeschool/onboarding/service.ts` persists a curriculum source and redirects into `Today`, but it does not yet model upload-backed intake, source interpretation, or async Today boot.
- `app/(parent)/today/page.tsx` and `components/planning/today-workspace-view.tsx` still treat lesson and activity generation as follow-on flows rather than the launch contract itself.
- `learning-core` exposes `session_generate`, `activity_generate`, and curriculum operations, but it does not yet have `source_interpret` or bounded-plan generation.

## Decisions To Freeze

### Launch Rules

1. Onboarding completion must auto-trigger lesson generation.
2. Activity generation must auto-follow lesson generation.
3. Weak input must never be stretched into a fake week.
4. Launch intake modalities are limited to typed text, pasted outline, photographed page/photo, PDF, and dragged file upload.
5. Polished activation-metrics semantics remain deferred until the launch loop is correct.

### Routing Matrix

| Intake signal | Default route family | Allowed horizon ceiling | Notes |
| --- | --- | --- | --- |
| single assignment, chapter, photographed page | `single_day_material` | `today` | May expand later only by explicit parent action |
| weekly assignment sheet or week notes | `weekly_assignments` | `current_week` | Can produce a bounded current-week route |
| outline or table of contents | `sequence_outline` | `next_few_days` | Starter module only if the source is clearly coherent |
| topic seed or parent-authored idea | `topic_seed` | `starter_module` | Never pretend this is a full curriculum |
| explicit parent request for shell only | `manual_shell` | `today` | No AI expansion without a later parent action |
| ambiguous or mixed-strength source | `needs_confirmation` | `today` until confirmed | UI must request confirmation before routing wider |

### Deferred Items

- polished activation score semantics
- broad autonomous background-worker expansion
- audio/video intake understanding
- deep reporting automation changes
- activity prompt rewrites beyond launch-loop hints
- native distribution work before the phone runtime is correct

## Implementation Scope

### Documentation

- add a dedicated April 14 planning index in this folder
- add the Phase 0 implementation doc

### App Contract Layer

- create one shared app-side contract module that defines:
  - supported intake modalities
  - launch route families
  - horizon ceilings
  - Today boot-state vocabulary
  - deferred items
- keep it behavior-neutral in Phase 0 so later phases can import it without immediately changing runtime flows

### Explicit Non-Goals

- no upload UI changes yet
- no new database tables yet
- no `learning-core` operation changes yet
- no Today generation orchestration changes yet

## Exit Criteria

- one written launch contract in repo
- one written routing matrix in repo
- one shared app-side contract module for later phases
- one explicit deferred list in repo
