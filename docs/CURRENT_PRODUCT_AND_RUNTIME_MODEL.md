# Current Product And Runtime Model

> Status: this is the operational source of truth for the current homeschool closed-beta product.
> Use this document before `VISION.md`, `PRODUCT_IMPLEMENTATION_PLAN.md`, or older architecture notes.

## Current Product Wedge

The product is homeschool first.

The current wedge is:

1. bring what you already have
2. create a usable curriculum and opening window
3. open Today fast
4. keep the week and records nearby

This is not a generic multi-domain launch.
Broader platform positioning and billing remain deferred.

## Product-Level Mental Model

The current generation chain is:

1. `source_interpret`
2. `curriculum_generate`
3. progression and planning handoff
4. day-1 and Today opening flow

That chain means the durable curriculum is the center of gravity.
Generated lessons and activities are downstream working artifacts, not the canonical source of truth.

## Source-First Flow

For source-entry onboarding and curriculum creation:

1. `homeschool-v2` collects learner, source, and organization context.
2. The app normalizes source text, source packages, and file attachments.
3. The app calls `learning-core` `source_interpret`.
4. The app calls `learning-core` `curriculum_generate` in `source_entry` mode.
5. The app imports the returned curriculum into app-owned curriculum records.
6. The app persists progression and then opens weekly and daily planning so the parent can reach Today quickly.

## Conversation-Only Intake

When the parent does not start from a concrete source:

1. the app calls `curriculum_generate` in `conversation_intake` mode
2. the app persists the returned curriculum
3. the app generates progression and opens the first practical slice of work

The curriculum is still durable.
Conversation intake is not a separate curriculum system.

Opening-window selection is downstream app behavior, not the canonical curriculum artifact itself.

## Today, Week, And Records

`homeschool-v2` owns:

- the parent-facing onboarding, curriculum, planning, Today, tracking, and account surfaces
- auth and active learner/session resolution
- Postgres and Supabase persistence
- curriculum import and normalization
- progression persistence and weekly route state
- Today materialization
- lesson draft and activity persistence
- progress, notes, attendance, evidence, and reporting records

`learning-core` owns:

- named AI operations such as `source_interpret`, `curriculum_generate`, `session_generate`, `activity_generate`, and `copilot_chat`
- prompt building, provider and model selection, prompt previews, lineage, and traces
- typed contracts and runtime execution

The app is the system of record.
`learning-core` returns typed artifacts; it does not write product rows directly.

## Copilot

Copilot is a real product surface, but it must stay bounded.

Current live route and components:

- `app/(parent)/copilot/page.tsx`
- `app/api/ai/chat/route.ts`
- `components/copilot/CopilotChat.tsx`
- `components/copilot/CopilotActionCard.tsx`
- `lib/learning-core/copilot.ts`
- `lib/planning/copilot-snapshot.ts`

Current rules:

- Copilot is grounded by learner, curriculum, daily, and weekly context assembled by the app.
- `learning-core` owns the Copilot prompt and answer generation.
- The app owns session storage, approval, dispatch, persistence, and any real product mutation.
- Do not assume that chat text can mutate plans, curriculum, or tracking state by itself.

## Canonical Ownership Boundaries

`homeschool-v2`

- product UI and routes
- auth and session
- persistence and reports
- planning and Today orchestration
- approved product mutations

`learning-core`

- AI runtime
- named operations and contracts
- prompt assembly
- provider and model choice
- prompt previews, lineage, and traces

## Explicitly Deferred

These are intentionally not part of the current operational model:

- billing readiness
- Stripe, checkout, pricing logic, or webhook rollout
- genericizing the product away from homeschooling
- treating Copilot as an unrestricted mutation surface
- broader agentic-platform claims as if they are already the shipping product

## Current Docs vs Vision Docs

Use these as current-state docs:

- this file
- `README.md`
- `docs/CANONICAL_STATE.md`
- `../docs/architecture/README.md`
- `../docs/architecture/onboarding-and-curriculum-flow.md`
- `../docs/architecture/repo-interaction-map.md`

Use these as direction or history, not current operational truth:

- `docs/VISION.md`
- `docs/PRODUCT_IMPLEMENTATION_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/AGENTIC_PLATFORM_ARCHITECTURE.md`
- older files under `docs/plans/`
