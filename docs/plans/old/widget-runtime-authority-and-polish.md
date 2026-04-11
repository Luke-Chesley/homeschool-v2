# Widget Runtime Authority And Polish

## Objective

Polish the rich interactive activity system so it is reliable, coherent, and reusable across domains.

This phase is about quality, authority, and reuse. It is not a push for more widget types or more chess-specific surface area.

## Current Baseline

The current architecture is directionally right:

- `learning-core/contracts/widgets.py` already defines typed widget payloads for `board_surface`, `expression_surface`, and `graph_surface`.
- `homeschool-v2/lib/activities/widgets.ts` mirrors those contracts on the frontend.
- `learning-core/skills/activity_generate/scripts/main.py` already does deterministic pack selection and only exposes base tooling plus active-pack tools.
- `learning-core/skills/activity_generate/scripts/tooling.py` is clean and only exposes `read_ui_spec` globally.
- `learning-core/skills/activity_generate/packs/chess/tools.py` keeps chess generation tools inside the chess pack.
- `learning-core/skills/activity_feedback/scripts/main.py` already evaluates chess widget responses with `python-chess` through `learning-core/domain/chess_engine.py`.
- `homeschool-v2/components/activities/v2/WidgetHost.tsx` and [SurfaceRegistry.tsx](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/components/activities/v2/surfaces/SurfaceRegistry.tsx) already provide a generic widget host and surface registry.

The main gaps are also concrete in the current code:

- [BoardSurface.tsx](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/components/activities/v2/surfaces/BoardSurface.tsx) still uses `chess.js` as the local rule engine, applies moves locally, computes legal targets locally, and updates local FEN before backend confirmation.
- `activity_feedback` is feedback-only. There is no canonical backend transition path for widget interaction state.
- Widget contracts currently encode capability, but not enough runtime UX semantics or authoring constraints.
- `activity_generate` only repairs schema-invalid output today. It does not repair semantically weak widget activities.

## Non-Goals

- Do not add more top-level chess-specific activity components.
- Do not make the frontend the canonical chess engine.
- Do not solve semantic quality only by expanding prompt prose.
- Do not turn widget payloads into freeform config blobs.
- Do not build a heavyweight plugin framework for packs.
- Do not overfit contracts so tightly to chess that `math_symbolic` or `graphing` become awkward.

## Architecture Decisions

### 1. Backend is canonical

`learning-core` should own:

- widget contract validation
- domain normalization
- legal state transitions
- deterministic evaluation
- runtime annotations when needed
- generation-time pack tools

### 2. Frontend is thin

`homeschool-v2` should own:

- rendering canonical widget state
- capturing learner gestures
- showing backend-returned transition and feedback state
- generic host/runtime wiring

The frontend may keep lightweight rendering helpers, but it must not own canonical domain truth.

### 3. Contracts must encode experience, not just data

Widget contracts need to specify runtime semantics such as view-only vs interactive, submission style, feedback mode, reset policy, and whether the surface is primary evidence or supporting context.

### 4. Packs stay local

Base `activity_generate` remains minimal. Pack-local tools and guidance remain pack-owned and are only activated when the pack is selected.

## Root Problems

### 1. Authoring quality is too loose

The model can emit widget payloads that are structurally valid but semantically weak:

- side to move is unclear
- prompt text can contradict the position
- the board can be present without being central evidence
- move-input activities can underuse interaction
- annotations can be decorative instead of instructional

### 2. Canonical engine boundaries are blurred

Backend chess evaluation already exists, but [BoardSurface.tsx](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/components/activities/v2/surfaces/BoardSurface.tsx) still owns move application and legal-target discovery through `chess.js`.

### 3. Contracts are capability-oriented instead of experience-oriented

The current chess widget contract mostly says "there is a board and expected moves." It does not say enough about side-to-move display, submission style, legal-target affordances, feedback display, or reset behavior.

### 4. Surface quality is not production-grade

The board works, but it still feels custom and provisional in interaction flow, affordances, and feedback transitions.

### 5. The reusable pattern is implied, not explicit

The current code suggests a general system, but the explicit template for future rich widgets has not been codified:

- backend transition path as the source of truth
- frontend as renderer plus gesture capture
- pack-local generation tools
- shared runtime semantics across widgets

## Workstreams

### 1. Strengthen widget contracts

#### Goal

Make widget payloads expressive enough to support polished UX and coherent generation.

#### Primary files

- `/Users/lukechesley/Desktop/learning-core/learning_core/contracts/widgets.py`
- [widgets.ts](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/lib/activities/widgets.ts)

#### Changes

Add bounded UX-level fields to the widget contracts.

For `board_surface` + `chess`, extend the contract with fields in shapes like:

- `display.showSideToMove`
- `display.showCoordinates`
- `display.showMoveHint`
- `display.boardRole` with values like `primary | supporting`
- `interaction.submissionMode` with values like `immediate | explicit_submit`
- `interaction.selectionMode` with values like `click_click | drag_drop | either`
- `interaction.showLegalTargets`
- `interaction.allowReset`
- `feedback.displayMode`
- `runtime.viewMode`
- `runtime.feedbackMode`
- `runtime.resetPolicy`
- `runtime.attemptPolicy`

Do the same structurally for `expression_surface` and `graph_surface`, even if the first pass is sparse. The point is to establish a shared model, not to fully flesh out every future widget now.

#### Requirements

- backend and frontend schemas remain aligned
- the fields stay typed, bounded, and documented
- no arbitrary config bag

#### Acceptance

- widget contracts describe interaction expectations, not just raw payload data
- future surfaces can conform to the same runtime model

### 2. Add authoring quality gates in `learning-core`

#### Goal

Stop low-quality widget-centered activities before they leave generation.

#### Primary files

- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/scripts/main.py`
- new validation modules under `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/validation/`

#### Changes

After the model returns an `ActivityArtifact`, run post-generation semantic validation before final success.

Split validation into:

- host-level widget validators for reusable rules
- chess-specific validators for position and move semantics

Examples of chess checks:

- FEN is valid and normalized
- prompt claims about check or checkmate match backend facts
- `expectedMoves` normalize through backend move parsing
- prompt and board state do not contradict each other
- annotations reference legal squares
- if move submission is expected, interaction mode actually supports it
- if the board is marked as primary, the activity composition reflects that
- side to move is clear through display config, prompt, or both

If semantic validation fails:

1. generate a targeted repair prompt
2. run one focused repair pass
3. revalidate
4. reject if it still fails

#### Requirements

- semantic validators are reusable by future engines and surfaces
- chess-specific rules live in chess-specific validators
- schema validation and semantic validation stay separate concerns

#### Acceptance

- invalid or incoherent widget activities are repaired or rejected
- quality improves without relying on ever-longer prompt prose

### 3. Introduce canonical backend widget transitions

#### Goal

Move widget interaction truth out of the frontend and into `learning-core`.

#### Primary files

- new `learning-core` skill or route for widget transitions
- `/Users/lukechesley/Desktop/learning-core/learning_core/domain/chess_engine.py`
- runtime integration files in `homeschool-v2`

#### Changes

Create a backend path for widget state transitions that is distinct from feedback.

Suggested request shape:

- activity id or widget payload
- component id
- current widget payload and state
- learner action
- current answer state
- attempt metadata

Suggested response shape:

- `accepted`
- `normalizedLearnerAction`
- `nextWidgetState`
- `annotations`
- `legalTargets`
- `allowedActions`
- `immediateFeedback`
- `error`

For chess:

- proposed move goes to backend
- backend normalizes SAN/UCI
- backend checks legality with `python-chess`
- backend returns normalized move payload plus canonical next state

#### Requirements

- keep `activity_feedback` focused on correctness and learner feedback semantics
- keep widget transition generalized enough for `math_symbolic` and `graphing`

#### Acceptance

- frontend no longer acts as the rule engine
- chess move handling is consistent across generation, interaction, and feedback

### 4. Thin the frontend surfaces

#### Goal

Keep the frontend focused on rendering and gesture capture.

#### Primary files

- [BoardSurface.tsx](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/components/activities/v2/surfaces/BoardSurface.tsx)
- [SurfaceRegistry.tsx](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/components/activities/v2/surfaces/SurfaceRegistry.tsx)
- [types.ts](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/components/activities/v2/types.ts)
- [feedback.ts](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/lib/activities/feedback.ts)
- [session-service.ts](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/lib/activities/session-service.ts)

#### Changes

Refactor the board surface to this flow:

1. render backend-provided board state
2. capture gesture
3. call backend transition endpoint
4. update UI from backend response
5. call feedback endpoint when the widget runtime semantics say feedback should occur

Frontend helpers can still support rendering, selection visuals, and optimistic loading indicators, but they must not be authoritative on legality or state transitions.

#### UX polish pass

- exact square sizing and stable aspect ratio
- explicit side-to-move display
- clearer selected-square and legal-target affordances
- reliable click-click and drag-drop behavior
- cleaner spacing and typography
- stronger pending, invalid, and feedback states
- reset and submit controls driven by contract semantics rather than ad hoc surface logic

#### Requirements

- keep `board_surface` generic instead of creating a chess-only top-level surface type
- any rendering library remains a rendering helper, not the engine of truth

#### Acceptance

- board UX feels reliable and production-grade
- frontend behavior is thinner and more predictable

### 5. Improve chess pack guidance without overfitting

#### Goal

Use the chess pack to improve activity composition quality, not just widget insertion.

#### Primary files

- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/packs/chess/pack.md`
- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/packs/chess/patterns.md`
- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/packs/chess/examples.md`
- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/packs/chess/pack.py`

#### Changes

Update chess pack guidance so it teaches the model:

- the board should usually be primary evidence when the position is the lesson
- supporting components should add explanation, reflection, comparison, or confidence
- side to move should always be obvious
- text claims about the position should be avoided unless they can be justified by backend checks
- annotations should be instructional, not decorative
- board-centered lessons should not collapse into shallow one-move prompts unless that really is the objective

Refresh examples to show richer compositions such as:

- board + `compare_and_explain`
- board + `confidence_check`
- board + `reflection_prompt`
- board + move selection + reasoning

#### Requirements

- keep chess-specific guidance inside the chess pack
- use this as the model for future packs

#### Acceptance

- chess activities make better use of the board
- pack guidance improves composition quality materially

### 6. Formalize the pack-local tool pattern

#### Goal

Make pack-local tool activation the explicit standard pattern.

#### Primary files

- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/scripts/tooling.py`
- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/scripts/main.py`
- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/packs/base.py`
- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/packs/chess/tools.py`
- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/packs/math/tools.py`
- `/Users/lukechesley/Desktop/learning-core/learning_core/skills/activity_generate/packs/*/pack.py`

#### Changes

Keep the current split, but formalize it:

- base tooling stays in `scripts/tooling.py`
- each pack owns `prompt_sections()` and `tools()`
- add a small helper to assemble active pack tools
- log `active_tools` and `included_packs` in traces and provider logs
- enforce that inactive-pack tools never leak into the run

#### Requirements

- stay lightweight and explicit
- avoid turning this into an unnecessary framework

#### Acceptance

- pack-local tool registration is the default pattern
- base `activity_generate` stays minimal

### 7. Add widget-centered runtime semantics

#### Goal

Make runtime behavior coherent across all current and future widgets.

#### Changes

Define a shared runtime semantics layer in the widget contracts and interpret it consistently in both repos.

Core semantics:

- `view_only` vs `interactive`
- `immediate_feedback` vs `submit_then_feedback`
- reset policy
- attempt policy
- feedback display mode
- surface role such as `primary` vs `supporting`

This should apply to chess first, but should be expressed generally enough to cover symbolic math and graphing.

#### Requirements

- no bespoke one-off runtime behavior per widget
- runtime semantics remain typed and bounded

#### Acceptance

- future widgets can inherit the same runtime model
- chess is no longer the only place where interaction semantics are defined

### 8. Test strategy

#### Backend tests in `learning-core`

Add tests for:

- widget contract validation
- widget runtime semantics validation
- semantic widget authoring validators
- chess widget repair path
- pack-local tool activation
- inactive-pack tool exclusion
- widget transition request and response validation
- chess move normalization and legality
- consistency between generated chess claims and backend engine facts

#### Frontend tests in `homeschool-v2`

Add tests for:

- `interactive_widget` host behavior
- board surface render consistency
- board surface interaction using backend transition responses
- side-to-move display
- reset and submission behavior
- feedback state display
- non-chess surface regression coverage

#### Cross-repo integration tests

Add at least a thin end-to-end path covering:

1. generated chess activity artifact
2. rendered board state
3. learner move submission
4. backend transition normalization
5. backend feedback result
6. repair of a semantically bad chess activity

## Recommended Execution Order

### Phase 1. Contracts and semantics

- strengthen widget contracts
- introduce shared runtime semantics

This phase establishes the contract that the rest of the system will implement.

### Phase 2. Generation quality

- add host-level widget validation
- add chess semantic validation and repair
- tighten chess pack guidance
- formalize pack-local tool activation and trace logging

This phase raises authoring quality before runtime changes land.

### Phase 3. Runtime authority

- implement canonical backend widget transitions
- refactor frontend runtime flow to consume transitions

This phase removes duplicated domain truth.

### Phase 4. Surface polish

- polish board interaction details
- make feedback, pending, invalid, and reset states coherent

This phase should happen on top of the canonical backend path, not before it.

### Phase 5. Verification

- add backend tests
- add frontend tests
- add cross-repo integration tests

## Dependency Notes

- Do not start frontend board polish as the main effort until transition semantics and API shape are stable. Otherwise the surface will be refactored twice.
- Contract changes in `learning-core` and `homeschool-v2` must land together or behind a version gate.
- The authoring validator should depend on the same backend chess helpers used by runtime transitions and feedback, so the system has one chess truth path.

## Deliverables

By the end of this project:

- widget contracts encode runtime UX semantics
- generated chess widget activities are semantically coherent, not just schema-valid
- widget transitions have a canonical backend path
- the frontend board is a thin render-and-capture layer
- board interaction quality is visibly improved
- pack-local tool registration is the normal `activity_generate` pattern
- the system is a reusable template for future `math_symbolic` and `graphing` widgets

## Definition Of Done

Done means:

- generated widget activities are semantically coherent
- chess activities clearly indicate side to move and align text with real board facts
- board interactions no longer feel clunky or inconsistent
- backend is authoritative for widget transitions and evaluation
- frontend surfaces are thin render/capture layers
- pack-local tool activation is the standard pattern
- the architecture is more general, not more chess-specific

## Implementation Notes From Current Code

These are the highest-value code-level observations from the current state:

- `learning-core/contracts/widgets.py` and [widgets.ts](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/lib/activities/widgets.ts) are still limited to `surface`, `state`, `interaction.mode`, `evaluation`, and `annotations`.
- `learning-core/skills/activity_generate/scripts/main.py` already has one repair loop, but it only handles schema validation failure.
- `learning-core/skills/activity_feedback/scripts/main.py` already has a deterministic chess path, so the transition skill should reuse the same engine layer instead of creating a parallel chess implementation.
- `learning-core/domain/chess_engine.py` already exposes `validate_fen`, `normalize_move`, `apply_move`, `evaluate_move`, and `describe_position`, which is a good base for both validation and transition work.
- [BoardSurface.tsx](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/components/activities/v2/surfaces/BoardSurface.tsx) currently updates `fenAfter` locally, derives legal targets locally, and requests feedback after local move application.
- [WidgetHost.tsx](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/components/activities/v2/WidgetHost.tsx) and [SurfaceRegistry.tsx](/Users/lukechesley/Desktop/homeschool-v2/.worktrees/widget-runtime-plan/components/activities/v2/surfaces/SurfaceRegistry.tsx) are already generic enough to support a cleaner shared widget runtime layer.
