# AI Intake, Generation, and Mobile Launch Plan

## Purpose

This plan replaces the earlier activation-only framing with a tighter launch model centered on:

- fast intake from whatever the parent has
- immediate AI-assisted generation of a real teachable day
- automatic follow-on activity generation
- bounded horizon behavior that never silently stretches weak inputs into a fake week
- mobile-native distribution only after the web/runtime contract is correct

This plan is intentionally biased toward the homeschool launch wedge, while preserving the existing `learning-core` service boundary and the broader event-driven platform direction.

## Product Contract To Launch Against

A parent should be able to:

1. add a learner
2. provide any one of:
   - typed text
   - pasted outline
   - photographed page or TOC
   - PDF
   - dragged file
3. tell the app either:
   - use this for today only
   - auto-expand only if the source clearly supports more
4. land in `Today`
5. see one generated lesson draft automatically
6. see activity generation start automatically from that lesson draft
7. regenerate with more context when needed
8. expand to the next few days or week only when the source warrants it

The core promise is:

**Give us what you have, and we will turn it into a teachable day without forcing you to import an entire curriculum.**

## Current State From Code Review

### What is already strong

1. The app now has a real fast-path onboarding surface with explicit intake routes and preview metadata.
2. `homeschool-v2` talks to `learning-core` through named operations instead of app-owned ad hoc prompt strings.
3. `session_generate` and `activity_generate` are already cleanly separated.
4. The activity pipeline is especially solid because it is grounded in a structured lesson draft, validated, and schema-driven.
5. The current architecture already points toward event-driven/background AI rather than one giant synchronous chat product.

### What is still misaligned

1. Fast-path onboarding still treats many partial inputs as curriculum-generation inputs.
2. The onboarding AI path is still source-first and curriculum-first, not day-first.
3. The onboarding flow does not yet support image/PDF/file intake.
4. `Today` still depends on a saved lesson draft already existing; it does not guarantee one on first arrival.
5. Activity generation is still a separate user action rather than an automatic follow-on from lesson generation.
6. Horizon selection exists, but it is not yet enforced as a hard behavioral contract throughout the AI pipeline.
7. Long-running generation is still too synchronous in the onboarding / first-day path.

## Architectural Position

### Keep

- one homeschool-facing app surface in `homeschool-v2`
- one externalized `learning-core` service boundary
- typed operations instead of prompt strings from the app
- structured lesson drafts as the main lesson artifact
- lesson-draft-based activity generation
- durable curriculum / planning / progress records as canonical system state

### Change

- stop using the same curriculum-generation path for every intake strength
- introduce explicit source normalization before generation
- invert first-run activation from **source -> route -> today -> manual lesson generate** to **source -> interpret -> lesson generate -> activity generate -> optional route expansion**
- move long onboarding generation into background job orchestration

## Launch Rules

### Rule 1: Weak input never becomes fake scope

If the parent gives one lesson, one chapter excerpt, or one photographed page, the app may generate:

- today only
- today plus a tentative tomorrow suggestion

It may **not** silently invent a full week or full curriculum.

### Rule 2: AI must be visible at the moment of value

The onboarding flow should not end with an empty Today page and a `Generate` button.
The onboarding completion path itself must trigger:

- lesson generation automatically
- activity generation automatically after lesson generation succeeds

### Rule 3: Activity generation depends on lesson generation

The lesson draft is the authoritative handoff into activity generation.
Activity generation should not run from raw intake directly.

### Rule 4: Route by source strength, not by one generic AI mode

The system should not send `single_lesson`, `weekly_plan`, `outline`, and `topic` through one overloaded curriculum-generation prompt.

### Rule 5: Mobile distribution follows runtime correctness

Native packaging comes after the launch contract works on phone-sized runtime surfaces.
The app should not ship a native wrapper over a still-wrong onboarding/generation flow.

## Recommended AI Pipeline

## 1. Intake Collection

### Inputs to support immediately

- typed or pasted text
- image upload
- PDF upload
- generic file drag/drop where safely supported
- camera capture from phone

### App responsibility

`homeschool-v2` should own raw asset intake, storage, upload auth, and initial extraction orchestration.
This is the right place to handle:

- multipart uploads
- storage paths / signed URLs
- per-household permissions
- linking assets to the learner / onboarding draft

## 2. Source Normalization

Create a first-class normalized object before calling generation.

### Proposed object: `NormalizedIntakeSourcePackage`

Fields:

- `learner_id`
- `intake_route_requested`
- `input_modalities` (`text`, `image`, `pdf`, `file`)
- `raw_text`
- `extracted_text`
- `extracted_structure`
- `asset_refs`
- `user_horizon_intent` (`today_only`, `auto`)
- `system_detected_source_kind`
- `system_detected_scope_strength`
- `system_recommended_horizon`
- `confidence`
- `assumptions`
- `title_candidate`
- `needs_confirmation`

### Why this object matters

It separates:

- file handling
- extraction
- source interpretation
- downstream generation

Without this layer, the system will keep conflating “what did the parent upload?” with “what should we generate?”

## 3. Source Interpretation

Add a new bounded operation in `learning-core`.

### Proposed new operation: `source_interpret`

#### Job

Given a normalized source package, return a bounded interpretation of what the source actually is.

#### Output

- `source_kind`
  - `single_day_material`
  - `weekly_assignments`
  - `sequence_outline`
  - `topic_seed`
  - `manual_shell`
  - `ambiguous`
- `suggested_title`
- `confidence`
- `recommended_horizon`
- `assumptions`
- `detected_chunks`
- `follow_up_question` (optional)
- `needs_confirmation`

#### Important rule

This operation should **not** generate curriculum or lesson content.
Its job is interpretation and routing.

## 4. Route Selection

Do **not** let a hidden agent silently choose everything.
Use programmatic routing with explicit policy.

### Recommended router logic

#### A. `single_day_material`
Use when the source is one day, one chapter excerpt, one worksheet page, one assignment sheet, etc.

Pipeline:

1. source interpret
2. create provisional day-scoped curriculum fragment / route seed
3. generate lesson draft immediately
4. auto-trigger activity generation
5. offer “expand to tomorrow” only if confidence permits

#### B. `weekly_assignments`
Use when the source is clearly a weekly plan or multi-day assignment set.

Pipeline:

1. source interpret
2. build bounded week route
3. generate today lesson draft
4. auto-trigger activity generation
5. persist the rest of the week as planned items

#### C. `sequence_outline`
Use when the source is a table of contents, scope-and-sequence, or chapter outline.

Pipeline:

1. source interpret
2. build bounded curriculum fragment or short route window
3. materialize today or next few days
4. offer explicit expansion into a larger route

#### D. `topic_seed`
Use when the parent starts from scratch.

Pipeline:

1. optional short intake clarification
2. `curriculum_generate` for a starter module
3. create bounded route window
4. generate today lesson draft
5. auto-trigger activity generation

#### E. `manual_shell`
Use only when the user wants structure without AI filling details yet.

Pipeline:

1. create shell
2. land in Today with clear “add source to generate lesson” state

## 5. Lesson Generation

Use `session_generate` as the main “wow moment” operation.
That operation is already the strongest fit for generating the parent-facing teachable day.

### Change in responsibility

Today lesson generation should become the first guaranteed generated artifact during onboarding.
It should not wait for the parent to press a button after onboarding.

### Proposed additions to session input context

The `session_generate` contract can stay mostly intact, but the app should pass richer context:

- `sourceKind`
- `scopeStrength`
- `chosenHorizon`
- `assumptions`
- `intakeSourceSummary`
- `inputModality`
- `expansionPolicy`
- `generationMode` (`onboarding_boot`, `today_regenerate`, `expansion_followup`)

No large contract rewrite is required here unless you want these to become top-level typed fields later.
For launch, app-level context is probably enough.

## 6. Activity Generation

Keep `activity_generate` as a follow-on operation.
This part is already aligned.

### Required change

The app should automatically enqueue activity generation after lesson generation completes.

### User experience

When the user lands in Today:

- lesson draft appears first
- activity card immediately shows `Building activity…`
- when ready, the activity card turns into `Open activity`

### Required controls

- regenerate lesson
- add context and regenerate lesson
- regenerate activity
- keep this bounded to today
- expand into next few days / current week

## Proposed Learning-Core Changes

## New operations to add

### 1. `source_interpret`
First new priority.

Purpose:
- classify the intake
- recommend horizon
- produce assumptions
- keep routing honest

### 2. `curriculum_generate`
Second new priority.

Purpose:
- generate the durable curriculum
- support both source-first and conversation-first creation
- keep the opening window bounded through `launchPlan`

This operation should be used for:
- single-day material
- weekly assignment sets
- sequence outlines

It should return a durable curriculum while keeping launch scope bounded through `launchPlan`.

### Keep existing operations

- `curriculum_generate` for full starter modules / topic-led generation
- `session_generate` for the actual lesson draft
- `activity_generate` for the activity derived from the lesson draft

## Prompt changes to make

### `curriculum_generate`
Keep this prompt focused on real curriculum generation.
Do not turn it into an everything-prompt.

### `session_generate`
Adjust prompt wording slightly so it performs well from partial-source onboarding flows, not just route-rich planning flows.
It should work whether context comes from:

- a full route board
- a bounded day seed
- a provisional route fragment

### `activity_generate`
Only minor changes if needed.
Most of the value problem is upstream, not here.

## Proposed homeschool-v2 Changes

## A. Onboarding API and storage

### Replace JSON-only intake with asset-capable flow

Introduce an onboarding intake pipeline that can handle:

- `multipart/form-data`
- pre-uploaded asset IDs
- text-only fallback

### New records

- `onboarding_intake_assets`
- `onboarding_source_packages`
- `today_generation_jobs`
- `today_generation_results`

These do not need to be permanent final domain names, but the concepts should exist.

## B. Onboarding UX

### Step 1
Add learner name.

### Step 2
Choose input method:
- type / paste
- upload image
- upload PDF
- drag file
- take photo

### Step 3
Optional horizon choice:
- Today only
- Auto-expand if the source clearly supports more

### Step 4
Quick interpretation preview only when needed:
- “We think this is one day of material”
- “We think this is a weekly assignment list”
- “We think this is a sequence outline”

### Step 5
Submit and immediately transition to Today build state.

## C. Today boot experience

The Today page needs explicit AI boot states.

### Proposed states

- `building_lesson`
- `lesson_ready_building_activity`
- `ready`
- `needs_confirmation`
- `generation_failed`

### Important behavioral change

On first arrival from onboarding:
- do not show an empty lesson panel with a passive Generate button
- do not rely on saved draft existence from prior actions
- do show structured loading and generation progress

## D. Background orchestration

You already want to avoid long AI calls in normal request/response paths.
This onboarding flow should follow that rule.

### Recommended jobs

1. `extract_intake_assets`
2. `interpret_source_package`
3. `materialize_launch_window`
4. `generate_today_lesson`
5. `generate_today_activity`

These can be executed with your preferred background mechanism later, but the product contract should assume asynchronous execution now.

## E. Persistence order

Recommended generation order:

1. intake package
2. interpreted source package
3. bounded route / provisional source records
4. saved lesson draft
5. published activity

Do not make full curriculum persistence the gating requirement for first-day value.

## Detailed Phase Plan

## Phase 0 — Lock the AI launch contract

### Goal

Agree on what must be true for launch.

### Scope

- freeze the rule that onboarding must auto-trigger lesson generation
- freeze the rule that activity auto-follows lesson generation
- freeze the no-fake-week policy
- freeze the supported input modalities for launch
- explicitly defer polished activation metrics

### Exit criteria

- one written launch contract
- one routing matrix
- one list of deferred items

## Phase 1 — Intake modalities and source package layer

### Goal

Support text, image, PDF, and file intake with one normalized source package.

### Scope

#### homeschool-v2
- add intake UI for text/image/PDF/file/photo
- add upload and asset persistence
- add extraction orchestration
- create `NormalizedIntakeSourcePackage`
- replace JSON-only onboarding assumption

#### learning-core
- none required yet beyond accepting normalized text content later

### Exit criteria

- parent can upload or paste any supported source
- system stores extracted content and source metadata
- app can present a normalized package before generation

## Phase 2 — Source interpretation and routing

### Goal

Stop routing weak inputs into the wrong generation path.

### Scope

#### learning-core
- add `source_interpret`
- define typed request/response contracts
- build prompt and tests for classification / horizon / assumptions

#### homeschool-v2
- add route-selection policy using
  - requested intake route
  - normalized source package
  - `source_interpret` result
  - user horizon choice

### Exit criteria

- `single_day_material` does not hit full curriculum generation
- `weekly_assignments` route distinctly from `topic_seed`
- ambiguous cases can request confirmation

## Phase 3 — Curriculum generation with bounded launch

### Goal

Generate the smallest durable planning object that supports Today.

### Scope

#### learning-core
- route source-first creation through `curriculum_generate`
- return one durable curriculum plus `launchPlan`

#### homeschool-v2
- persist provisional source / route records from bounded outputs
- keep expansion explicit and reversible

### Exit criteria

- one photographed day can generate a bounded route without inventing a curriculum
- weekly inputs generate a current-week route
- topic inputs can still produce starter modules

## Phase 4 — Onboarding-triggered Today generation

### Goal

Make the first wow moment automatic.

### Scope

#### homeschool-v2
- convert onboarding completion into an async build sequence
- add Today boot states
- save lesson draft before first Today render completes
- stop requiring manual button press on first arrival

#### learning-core
- reuse `session_generate`
- optionally pass richer context about source kind and horizon

### Exit criteria

- parent finishes onboarding and lands in Today
- lesson draft is building automatically
- no empty-state Generate button on first arrival

## Phase 5 — Automatic activity chaining and AI UX polish

### Goal

Turn lesson generation into a visible AI-assisted day builder.

### Scope

#### homeschool-v2
- automatically enqueue activity generation after lesson success
- show `Building activity…`
- show stale / regenerate states clearly
- add “Add context and regenerate” affordance
- add “Keep this to today” and “Expand from here” affordances

#### learning-core
- keep `activity_generate` largely as-is
- optionally add light contextual hints for onboarding mode

### Exit criteria

- activity appears without separate initial click
- regenerate flows are explicit and controlled
- AI behavior feels like product support, not AI theater

## Phase 6 — Weekly continuity and expansion controls

### Goal

Let strong inputs become durable schedules without stretching weak inputs.

### Scope

- add explicit expansion actions:
  - expand to tomorrow
  - expand to next few days
  - expand to current week
- allow the parent to approve larger expansion when the source is strong enough
- keep the first lesson and activity as the initial value moment

### Exit criteria

- weak sources stay bounded
- stronger sources can expand cleanly
- progression logic remains coherent after expansion

## Phase 7 — Phone runtime hardening

### Goal

Make the corrected launch flow work beautifully on phone before native packaging.

### Scope

- camera/photo intake flow
- upload progress and retry states
- Today boot/loading states on mobile
- thumb-friendly lesson and activity controls
- resilient auth/session persistence
- fast resume into Today build state

### Exit criteria

- onboarding + Today boot + activity open all feel good on phone
- photo capture and upload are first-class
- no desktop-only assumptions remain in the AI intake flow

## Phase 8 — Thin native shell

### Goal

Ship native distribution around the now-correct flow.

### Scope

Build a thin native shell around:

- sign in
- learner switching
- intake capture
- Today
- activity open
- notifications / deep-link re-entry later

### Requirements before starting

- Phase 1 through Phase 7 complete
- store billing shape decided
- native packaging does not fork core product logic

### Exit criteria

- one shared backend and one shared product model
- native shell adds distribution and device affordances, not a second product

## What To Defer

- perfect activation metric semantics
- broad agentic background worker system beyond the launch loop
- audio/video multimodal session understanding
- deep reporting automation changes
- major activity prompt rewrites unless evidence shows they are needed
- full native feature breadth beyond the thin shell

## Practical Recommendation

### Build next in this order

1. source package + uploads
2. `source_interpret`
3. bounded plan generation
4. onboarding-triggered `session_generate`
5. automatic `activity_generate`
6. mobile phone-runtime hardening
7. thin native shell

### Do not do next

- do not expand the metrics plan first
- do not add a broad “agent figures it out” layer before routing is explicit
- do not keep overloading `curriculum_generate` for partial inputs
- do not ship native over an onboarding flow that still ends in an empty Today state

## Final Product Framing

The launch product should feel like this:

**Take a picture, paste a plan, upload a PDF, or type what you have. We turn it into today’s lesson, start the activity for you, and only expand when the source supports it.**
