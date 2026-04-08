# Homeschool Wedge

## Target Buyer

The V1 buyer is a homeschooling parent running day-to-day instruction at home. The product is optimized for a parent who already has curriculum materials, broad goals, or a rough syllabus, but needs a practical operating system for planning the week, running today, adjusting when life happens, and keeping usable records without extra bookkeeping.

## Product Promise

Turn curriculum into a workable week, adapt when life happens, and keep records automatically.

## V1 Workflow

1. Parent enters or imports household setup details.
2. Parent creates one or more learner profiles.
3. Parent adds curriculum manually, pastes a structured outline, or uses AI-assisted decomposition from source material.
4. The app generates the first workable week using learner constraints and household preferences.
5. The parent runs the day from one clear daily workspace.
6. The parent marks work as done, partial, skipped, moved, or paused.
7. The app records progress, attendance, notes, evidence, and summaries as the workflow happens.
8. The parent reviews weekly and monthly summaries and exports useful records.

## V1 Non-Goals

- district LMS integrations
- enterprise onboarding
- marketplace
- billing
- complex standards logic
- auth overhaul
- audio recording, transcription, or summarization

## Product Shape

- Keep one homeschool-facing product surface.
- Keep canonical domain rules in `lib/domain/*`.
- Put homeschool workflow semantics in `lib/homeschool/*`.
- Put labels, defaults, and policies in `config/templates/*`.
- Add only the minimum generic core needed to make the homeschool loop durable.
