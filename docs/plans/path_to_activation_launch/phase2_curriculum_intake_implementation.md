# Phase 2: Curriculum Intake Implementation

## Purpose

This document turns Phase 2 from product policy into implementation work.

Phase 0 and Phase 1 already established the fast path to `Today`:

- one learner
- one source input
- one short generation loop
- one first-day activation milestone

That is enough to prove first-session value.
It is not enough to make curriculum intake trustworthy for real households with messy source material.

Phase 2 exists to make intake routes, horizon decisions, preview behavior, provenance, and regeneration rules explicit in the product and in the code.

## Current State

The merged Phase 0 / 1 work already gives us a partial Phase 2 foundation:

- onboarding exposes parent-facing route labels in `components/onboarding/homeschool-onboarding-form.tsx`
- the onboarding service accepts `intakeType`, `sourceInput`, and `horizonIntent` in `lib/homeschool/onboarding/types.ts`
- `runHomeschoolFastPathOnboarding` in `lib/homeschool/onboarding/service.ts` builds a lightweight preview and records intake metadata under organization onboarding state
- the current fast path maps intake into the existing curriculum modes:
  - `book_curriculum` -> `ai_decompose`
  - `outline_weekly_plan` -> `paste_outline`
  - `topic` -> `manual_shell`
- the current implementation always materializes a curriculum source, creates a weekly route board, and opens `Today`

That is a useful bridge, but it is still too coarse for launch-quality intake.

Current gaps:

- route taxonomy is still compressed into legacy `curriculumMode` behavior
- there is no dedicated persisted intake record or source-intake contract on the curriculum source
- preview is heuristic and read-only instead of a real correction step
- horizon policy is only `today` vs `next_few_days`, and it is not persisted as a first-class planning decision
- generation and regeneration rules are not yet defined around progress preservation
- upload / asset-backed intake is not defined as part of the launch path

## Phase 2 Outcome

At the end of this phase:

- the product supports the launch intake routes with explicit route semantics
- the system persists intake provenance and horizon decisions on the curriculum source
- lower-confidence inputs route through preview and correction before destructive save
- regeneration rules are explicit and safe around existing plan / progress state
- onboarding fast path and later curriculum refinement use the same intake vocabulary

## Scope

### In Scope

- launch intake route taxonomy
- horizon policy and stored horizon decisions
- preview and quick correction for medium / low confidence routes
- curriculum source provenance metadata
- regeneration rules for replacing or extending a source
- upload-ready intake contract for assets, even if OCR remains modest
- QA coverage for realistic parent input patterns

### Out Of Scope

- publisher-specific importers
- deep OCR pipelines
- standards mapping
- broad curriculum marketplace behavior
- cross-household collaboration
- native mobile packaging

## Product Decisions To Lock

### Launch Routes

Use these product-facing routes as the canonical launch set:

1. `single_lesson`
   Best for chapter pages, workbook pages, a single assignment, or one day of co-op follow-up.

2. `weekly_plan`
   Best for a weekly assignment list or copied teacher notes.

3. `outline`
   Best for a table of contents, chapter list, syllabus, or scope-and-sequence style paste.

4. `topic`
   Best for a bounded starter module from scratch.

5. `manual_shell`
   Best for fallback setup when the parent only knows the subject area or wants to scaffold slowly.

These should replace the current overloaded Phase 1 route shape:

- `book_curriculum`
- `outline_weekly_plan`
- `topic`

The launch UX can still collapse some choices visually if needed, but the backend should persist the real intake route explicitly.

### Canonical Horizon Values

Persist horizon using launch-facing values:

- `today`
- `tomorrow`
- `next_few_days`
- `current_week`
- `starter_module`
- `starter_week`

Also persist how the horizon was chosen:

- `system_default`
- `confidence_limited`
- `user_selected`
- `user_corrected_in_preview`
- `manual_regeneration`

### Confidence Levels

Phase 2 should move beyond length-based heuristics and standardize confidence as:

- `low`
- `medium`
- `high`

Confidence should be based on:

- route type
- source length
- line / chunk structure
- presence of sequence markers
- presence of time markers
- explicit horizon request
- presence of uploaded assets with extractable text

## Implementation Strategy

### Workstream 1: Canonical Intake Contract

Create a new intake contract that is independent from the old `curriculumMode` abstraction.

Primary files:

- `lib/homeschool/onboarding/types.ts`
- `lib/homeschool/onboarding/service.ts`
- `lib/homeschool/onboarding/activation-contracts.ts`
- `app/api/homeschool/onboarding/route.ts`

Add:

- `CurriculumIntakeRoute`
- `CurriculumGenerationHorizon`
- `CurriculumHorizonDecisionSource`
- `CurriculumIntakeConfidence`
- `CurriculumIntakePreview`
- `CurriculumIntakeCorrectionInput`

Rules:

- onboarding API should accept the canonical route values, not only Phase 1 aliases
- Phase 1 aliases can remain temporarily for backward compatibility at the API boundary
- mapping from route to generation strategy should happen in one place only

### Workstream 2: Source Provenance Persistence

Persist intake provenance on `curriculum_sources.metadata` as the launch source of truth for intake behavior.

Primary files:

- `lib/db/schema/curriculum.ts`
- `lib/curriculum/service.ts`
- `lib/curriculum/types.ts`
- `lib/homeschool/onboarding/service.ts`

Add a stable `metadata.intake` shape on curriculum sources:

```ts
type CurriculumSourceIntakeMetadata = {
  route: "single_lesson" | "weekly_plan" | "outline" | "topic" | "manual_shell";
  routeVersion: 1;
  rawText?: string | null;
  assetIds?: string[];
  learnerId?: string | null;
  confidence: "low" | "medium" | "high";
  inferredHorizon: "today" | "tomorrow" | "next_few_days" | "current_week" | "starter_module" | "starter_week";
  chosenHorizon: "today" | "tomorrow" | "next_few_days" | "current_week" | "starter_module" | "starter_week";
  horizonDecisionSource: "system_default" | "confidence_limited" | "user_selected" | "user_corrected_in_preview" | "manual_regeneration";
  assumptions: string[];
  detectedChunks: Array<{ label: string; kind?: string }>;
  sourceFingerprint?: string;
  createdFrom: "onboarding_fast_path" | "curriculum_add_flow" | "curriculum_regeneration";
};
```

Rules:

- organization onboarding metadata can keep a summary for activation analytics
- curriculum-source metadata becomes the durable product record for future editing, regeneration, and QA inspection
- use `metadataColumn()` and metadata readers rather than adding many new top-level SQL columns unless query pressure forces it later

### Workstream 3: Preview And Correction Flow

Upgrade preview from a confirmation gate into a correction step.

Primary files:

- `components/onboarding/homeschool-onboarding-form.tsx`
- `app/api/homeschool/onboarding/route.ts`
- `lib/homeschool/onboarding/service.ts`

Preview must show:

- target learner
- interpreted route
- detected chunks
- chosen horizon
- short assumptions copy

Correction inputs for Phase 2:

- route
- horizon
- learner target
- title
- chunk labels

Rules:

- `low` and `medium` confidence routes require preview before final save
- `high` confidence routes may skip preview when the horizon is conservative
- if the parent edits route or horizon in preview, persist that as `horizonDecisionSource = user_corrected_in_preview`
- correction should not require returning to the full onboarding form

### Workstream 4: Horizon Policy In Generation

Generation should stop overcommitting beyond the source.

Primary files:

- `lib/homeschool/onboarding/service.ts`
- `lib/curriculum/service.ts`
- `lib/curriculum-routing/service.ts`
- `lib/planning/today-service.ts`

Required route behavior:

| Route | Default horizon | Allowed expansion | Notes |
| --- | --- | --- | --- |
| `single_lesson` | `today` | `tomorrow` only | Never auto-create a full week |
| `weekly_plan` | `current_week` | limited carryover | Best week-level input |
| `outline` | `next_few_days` | `current_week` after review | Preview should usually appear |
| `topic` | `starter_module` | extend later | Do not pretend this is a year plan |
| `manual_shell` | `today` or `starter_week` | manual only | Explicit fallback |

Rules:

- weekly route creation should respect the chosen horizon instead of assuming a full standard board shape
- `getOrCreateWeeklyRouteBoardForLearner` can stay on the path, but the generated route should be bounded by horizon-aware node activation or planning limits
- `Today` must still materialize immediately even when horizon is short

### Workstream 5: Upload-Ready Intake

Phase 2 should define the asset-backed route even if extraction quality is modest at launch.

Primary files:

- `lib/db/schema/curriculum.ts`
- `lib/homeschool/onboarding/service.ts`
- `components/onboarding/homeschool-onboarding-form.tsx`
- relevant upload API surface if added in this phase

Launch requirement:

- the parent can attach one or more assets as supporting intake evidence
- the system stores the asset references even if extraction falls back to manual confirmation
- uploaded assets should feed preview assumptions when text extraction exists

Non-goal:

- perfect OCR or publisher-grade parsing

### Workstream 6: Safe Regeneration

Define what can be regenerated without corrupting valid progress.

Primary files:

- `lib/curriculum/service.ts`
- `lib/tracking/service.ts`
- `lib/planning/service.ts`
- any curriculum revision or regeneration flow already in use

Phase 2 rules:

- replacing source interpretation should create a new import version on the same source when safe
- completed learner progress should not be silently deleted
- plan items with recorded progress should be retained or explicitly marked stale / superseded
- regeneration must capture provenance:
  - what changed
  - which route was used
  - whether horizon became longer or shorter

Minimum launch-safe behavior:

- if regeneration would orphan completed progress, warn before applying
- allow safe horizon shortening without deleting completion evidence
- allow extending from `today` to `next_few_days` or `current_week` after first activation

## Concrete File Targets

### Likely Touchpoints

- `components/onboarding/homeschool-onboarding-form.tsx`
- `app/api/homeschool/onboarding/route.ts`
- `lib/homeschool/onboarding/types.ts`
- `lib/homeschool/onboarding/service.ts`
- `lib/homeschool/onboarding/activation-contracts.ts`
- `lib/curriculum/service.ts`
- `lib/curriculum/types.ts`
- `lib/curriculum-routing/service.ts`
- `lib/planning/today-service.ts`
- `lib/tracking/service.ts`
- `lib/db/schema/curriculum.ts`

### Optional Follow-On Touchpoints

- curriculum add / refine UI surfaces
- learner account / source management surfaces
- upload API routes and storage helpers
- observability event catalog

## Data Shape Guidance

### Onboarding Metadata

Keep organization onboarding metadata small and activation-oriented:

- latest route
- latest confidence
- latest horizon
- activation timestamps

Do not make organization onboarding metadata the long-term home for curriculum interpretation details.

### Curriculum Source Metadata

Use curriculum source metadata for:

- durable intake provenance
- preview decisions
- source assumptions
- regeneration history summary

### Audit Events

Add audit coverage for:

- intake preview shown
- intake corrected
- source created from route
- source regenerated
- horizon expanded
- horizon shortened

## UX Notes

### Onboarding

Keep the current Phase 1 structure:

1. learner
2. route
3. source
4. preview if needed
5. Today

But update the route labels to match the canonical Phase 2 set more precisely.

### Post-Activation Refinement

After the first successful day:

- allow the parent to extend a `single_lesson` or `topic` source into a broader horizon
- allow adding a second source for the same learner without re-running household onboarding
- expose provenance in a quiet, inspectable way on curriculum surfaces

### Mobile

Phase 2 must preserve Phase 1 phone ergonomics:

- route picker remains simple
- preview remains one-screen readable
- upload and paste can coexist without stacked clutter

## QA Matrix

### Required Route Checks

- single chapter input generates `Today`, not a fake week
- weekly plan input generates a bounded current week
- outline input generates next few days and requires preview
- topic input generates a bounded starter module
- manual shell stays intentionally light

### Required Behavior Checks

- preview corrections change saved route / horizon metadata
- chosen horizon persists after refresh
- curriculum source metadata reflects route, confidence, assumptions, and decision source
- regeneration does not silently delete completed progress
- active learner context survives intake and refinement flows

### Required Mobile Checks

- paste-only onboarding on phone width
- upload-assisted onboarding on phone width
- preview confirmation and correction on phone width

## Rollout Order

1. Canonical type and metadata contracts
2. Preview and correction payloads
3. Route-specific horizon policy in onboarding generation
4. Curriculum source metadata persistence
5. Upload-backed intake support
6. Safe regeneration behavior
7. QA pass and checklist closeout

## Exit Criteria

Phase 2 is complete when:

- route taxonomy is canonical and no longer hidden behind legacy onboarding modes
- horizon decisions are explicit and inspectable
- preview allows correction rather than only confirmation
- curriculum sources retain durable intake provenance
- regeneration behavior is safe around existing progress
- intake works credibly for messy real parent inputs

## Recommended First PR Slice

The first implementation PR for Phase 2 should stay narrow:

1. add canonical intake route and horizon types
2. persist `curriculum_sources.metadata.intake`
3. upgrade preview payload to include assumptions and editable horizon
4. map current onboarding UI to the new canonical route values
5. add QA documentation for the four launch routes

Do not mix regeneration safety, asset upload, and broader curriculum management UI into that first PR.
