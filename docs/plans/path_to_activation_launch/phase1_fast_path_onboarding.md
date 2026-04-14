# Phase 1: Fast-Path Onboarding

## Purpose

The current onboarding path still behaves like a full household configuration flow.
That is appropriate for a fully configured homeschool OS.
It is not appropriate for first-session activation.

This phase rebuilds onboarding so the user reaches a teachable Today before they are asked to complete long household setup.

## Why This Matters

The current flow asks for household defaults, schedule defaults, learner details, curriculum mode, curriculum title, and often curriculum text before the user reaches `/today`.
That means the product explains a future payoff instead of proving immediate value.

This phase should reverse that order.

## Outcome

At the end of Phase 1:

- a new user can reach Today with dramatically fewer required fields
- the product can create a first usable day before full household setup is complete
- later setup fields move into post-activation refinement
- the system still supports durable data and later household configuration

## Target Fast Path

### Step 1: Add Learner

Required:

- learner name

Optional for later:

- grade
- age band
- pace preference
- load preference

### Step 2: Choose Input Type

User-facing options should be simple:

- I have a book or curriculum
- I have an outline or weekly plan
- Start from a topic
- Add another learner later

Avoid internal labels like `manual_shell`, `paste_outline`, and `ai_decompose` in the product UI.

### Step 3: Provide Source Material

Examples:

- chapter title and pages
- weekly assignment list
- pasted outline
- curriculum name plus rough notes
- photo or upload
- topic prompt

### Step 4: Generate The First Output

The system should generate one of:

- Today only
- Today + next 2 to 5 days
- first workable week

The choice should depend on source confidence and scope, not just one global default.

### Step 5: Run The Day

The product should land the user in Today with:

- at least one plan item
- one lesson draft available or preparing
- one activity available or one-tap generatable
- simple status actions

### Step 6: Expand Setup After Value

After the user sees Today, prompt for:

- additional learners
- school days
- time budget
- subjects
- teaching style
- school year / term dates
- standards preference

Do not block first value on these fields.

## Required UX Changes

### Replace One Big Form With Progressive Steps

Do not present the entire household model before value.
Split the current form into:

1. learner capture
2. intake route selection
3. source capture
4. generation
5. Today
6. optional refinement

### Add A "Use This For Just Today" Path

The current product implicitly leans toward building a workable week.
That is too heavy for many first-use cases.

Add a lightweight path that says:

> Teach from what you have today.

That path should still produce durable records and a next-step suggestion, but it should not force broader assumptions.

### Add A Preview Before Full Commit

Where generation confidence is moderate or low, show a lightweight preview before saving:

- detected lesson chunks
- proposed horizon
- plan title
- learner target

Let the user fix obvious mistakes quickly.

## Required Backend And Domain Changes

### Split "Onboarding Complete" From "First Day Ready"

The current onboarding service persists household setup, creates curriculum, creates a weekly route, materializes Today, and then marks onboarding complete.
That is too monolithic for fast activation.

Introduce smaller state milestones such as:

- `fast_path_started`
- `first_day_ready`
- `household_defaults_completed`
- `week_ready`

### Allow Incomplete Household Defaults

The domain model should allow:

- missing school year
- missing term dates
- missing standards preference
- missing teaching style
- missing subject list beyond the source itself

without blocking first value.

### Keep Durable Source Lineage

Even when intake is partial, preserve:

- source type
- raw source text or file reference
- learner target
- confidence level
- planning horizon used

## Analytics Requirements

Instrument at minimum:

- onboarding_started
- learner_name_submitted
- intake_type_selected
- intake_source_submitted
- generation_started
- generation_completed
- first_today_opened
- refinement_prompt_opened
- refinement_completed
- onboarding_abandoned_before_today

## Suggested Implementation Order

1. define the new onboarding state machine
2. redesign the first three screens around learner + input
3. separate optional household defaults from the first flow
4. add fast-path analytics
5. update redirect and post-generation behavior so Today becomes the default landing point
6. add later prompts for household refinement

## Exit Criteria

Phase 1 is complete when:

- a user can reach Today with one learner name and one meaningful input
- long household setup no longer blocks first value
- optional defaults can be completed later without data corruption
- the system records fast-path onboarding state explicitly
- onboarding analytics can identify where users drop off

## Explicit Deferrals

This phase does not need to solve:

- all curriculum import types
- app store packaging
- full billing
- perfect household settings UX
- broad reporting polish
