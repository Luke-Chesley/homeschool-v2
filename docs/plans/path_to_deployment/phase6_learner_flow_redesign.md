# Phase 6: Learner Flow Redesign

## Purpose

This document defines the redesign pass for the learner-facing experience.

Phase 6 should make the learner side of `homeschool-v2` feel as intentional as the parent product after Phase 5:

- calmer
- lighter
- more focused
- more touch-friendly
- easier to read
- easier to progress through without supervision

It should also close the gap between the parent `Today` surface and the learner runtime.
Activities should feel like the natural continuation of the day’s plan, not a hidden side route.

This phase is not a visual fork from the parent product.
It should extend the same design language into the learner flow while simplifying it further.

The learner product should feel like a clean daily work surface, not a management app and not a dashboard.

## Relationship To Phase 5

Phase 5 established the shared product language:

- restrained chrome
- quiet surfaces
- tighter copy
- one consistent shell language
- studio mode as an additive layer instead of the default product

Phase 6 should inherit those decisions directly.

Do not create a separate learner aesthetic.
Do not reintroduce louder colors, bigger chrome, denser controls, or more explanatory copy just because the route is different.

The learner surfaces should feel like the same product family with even less chrome and even clearer next actions.

## Source Design Brief

The target learner feel is:

- calm
- premium
- simple
- encouraging
- mobile-ready
- task-first

The learner should open the app and immediately understand:

- what work is next
- what can be resumed
- what has already been finished
- how to move forward

The learner should not need to parse admin language, debug language, planning language, or parent-only metadata.

## What This Phase Must Achieve

At the end of Phase 6, the learner product should have:

- a cleaner learner shell that matches the Phase 5 product language
- a stronger learner home / daily queue
- a clearer activity reading surface
- better phone and tablet ergonomics
- clearer empty, loading, submit, and completion states
- studio diagnostics still available, but visually secondary
- stronger consistency across learner home, activity runtime, and learner completion states
- a clearer handoff from parent `Today` into learner work

## What This Phase Is Not

This phase is not:

- a rewrite of the activity engine
- a re-spec of activity contracts
- a change to the scoring or attempt model
- a parent-shell redesign
- a marketing pass
- a dashboard pass

Do not:

- add parent-like management controls to learner routes
- add oversized hero sections
- add decorative progress dashboards or analytics
- put debug data back inline in the learner flow
- make the learner shell heavier than the current parent shell
- bury learner activities behind extra navigation if the parent is already working from `Today`

## Learner Product Principles

### 1. The Queue Is The Product

The learner home should read like a calm daily queue.

Its job is to answer:

- what should I do now
- what can I continue
- what is finished

It should not try to summarize the whole platform.

The queue should also feel connected to the parent’s daily flow.
If a parent is already shaping the day from `Today`, the path into learner work should be obvious.

### 2. Activity Comes First

Once a learner opens a session, the activity itself should dominate the page.

The shell, metadata, and controls should recede.

The learner should feel like they moved into a focused work surface rather than another app shell.

The transition from parent `Today` into learner work should therefore feel:

- obvious
- low-friction
- consistent with learner queue states
- visually part of the same daily flow

### 3. Reading Surface Over Widget Stack

Many activities contain instructional text, examples, prompts, and reflective responses.

Those should be presented as a guided reading-and-response surface with:

- stable vertical rhythm
- limited measure
- clear section boundaries
- consistent spacing between instruction and action

Do not let the learner runtime collapse into a pile of unrelated boxes.

### 4. Mobile And Tablet Are First-Class

Learner routes are more likely than parent routes to be used on:

- phones
- tablets
- small laptops

The learner experience should therefore optimize for:

- touch targets
- sticky submit / continue behavior only when useful
- shorter action rows
- fewer controls per line
- strong spacing between interactive elements

### 5. Product Mode Must Stay Clean

Learner routes are especially sensitive to debug clutter.

Studio mode should still expose:

- session payloads
- attempt state
- recent feedback exchanges
- transition exchanges

But product mode should remain focused on the learner’s task.

### 6. Copy Must Be Shorter Than On Parent Surfaces

Learner copy should be direct and confidence-building.

Use:

- short titles
- short status labels
- short completion language
- short next-step prompts

Avoid:

- setup narration
- workflow explanation
- parent-style planning terminology
- explanatory filler

## Primary Design Goals By Surface

### Learner Shell

Goals:

- reduce chrome further than the parent shell
- keep orientation clear without repeated bars
- preserve fast exit back to the parent workspace when needed

Target characteristics:

- one compact top utility bar
- one quiet learner identity marker
- no extra stacked header bands
- a central content column that begins quickly

### Learner Home / Queue

Goals:

- make the daily queue feel obvious and calm
- clarify the difference between in-progress, next, and done
- make session cards feel actionable without becoming card-heavy

Target characteristics:

- one page title with minimal metadata
- strong ordering of “resume” and “start”
- clearer rhythm between queue sections
- lighter section labels and less status noise
- clear continuity with how activities are surfaced from parent `Today`

### Parent Today To Learner Handoff

Goals:

- make learner activity access obvious from the parent operational center
- reduce the feeling that activities are hidden behind a separate route
- preserve a clear distinction between parent planning and learner execution without making them feel disconnected

Target characteristics:

- obvious launch points from `Today`
- consistent labels between parent daily work and learner queue states
- a parent can move from planning to learner work without hunting
- learner progress feels like the natural continuation of the day’s plan

### Activity Runtime

Goals:

- make the activity surface feel focused and readable
- reduce the sense of “generic form renderer”
- improve the relationship between instructions, interaction, and submission

Target characteristics:

- stronger activity frame
- narrower reading surface
- quieter back navigation
- clearer transition between working, submitting, and completed states

### Completion And Recovery States

Goals:

- make error, loading, and completion states feel intentional instead of leftover scaffolding
- help the learner recover without reading system language

Target characteristics:

- short, direct messaging
- local action buttons
- consistent spacing and hierarchy
- clear distinction between “keep going” and “return”

### Learner Studio Diagnostics

Goals:

- keep runtime diagnostics easy for an operator to reach
- remove any residual visual competition with the learner activity itself

Target characteristics:

- one secondary entry point
- drawer-based access
- no inline debug payloads in product mode

## Primary Files And Systems

### Learner Shell

Primary files:

- [app/(learner)/layout.tsx](/home/luke/Desktop/homeschool-v2/app/(learner)/layout.tsx)
- [components/studio/StudioToggle.tsx](/home/luke/Desktop/homeschool-v2/components/studio/StudioToggle.tsx)
- [app/globals.css](/home/luke/Desktop/homeschool-v2/app/globals.css)

### Learner Home

Primary files:

- [app/(learner)/learner/page.tsx](/home/luke/Desktop/homeschool-v2/app/(learner)/learner/page.tsx)
- [lib/activities/session-service.ts](/home/luke/Desktop/homeschool-v2/lib/activities/session-service.ts)

Related parent files:

- [app/(parent)/today/page.tsx](/home/luke/Desktop/homeschool-v2/app/(parent)/today/page.tsx)
- [components/planning](/home/luke/Desktop/homeschool-v2/components/planning)

### Activity Runtime

Primary files:

- [app/(learner)/activity/[sessionId]/page.tsx](/home/luke/Desktop/homeschool-v2/app/(learner)/activity/[sessionId]/page.tsx)
- [components/activities/ActivityRenderer.tsx](/home/luke/Desktop/homeschool-v2/components/activities/ActivityRenderer.tsx)
- [components/activities/v2/ActivitySpecRenderer.tsx](/home/luke/Desktop/homeschool-v2/components/activities/v2/ActivitySpecRenderer.tsx)

### Studio Diagnostics

Primary files:

- [components/activities/ActivityStudioPanel.tsx](/home/luke/Desktop/homeschool-v2/components/activities/ActivityStudioPanel.tsx)
- [components/studio](/home/luke/Desktop/homeschool-v2/components/studio)

## Design Constraints

- preserve current attempt, autosave, feedback, and submit behavior
- preserve existing route structure unless a route move is clearly necessary
- keep `/learner` as the learner home
- keep `/activity/[sessionId]` as the main learner runtime route
- keep studio diagnostics accessible on learner routes
- keep the learner flow visually aligned with the Phase 5 parent redesign
- make learner activities easier to reach from `Today` without turning `Today` into another dashboard
- optimize first for laptop and tablet scanability, then tighten for phone widths

## Sequencing Guidance

Recommended order:

1. learner shell
2. learner home / queue
3. activity reading surface
4. loading, error, and completion states
5. mobile and tablet ergonomics
6. studio boundary review
7. final consistency pass

## Review Questions

Use these on every learner surface before signoff:

- does the learner immediately understand the next action
- does the page start with content instead of chrome
- are touch targets and action rows comfortable on tablet width
- is long instructional text readable without looking like a document dump
- did studio mode remain available without leaking into product mode
- does this feel like the same calm product language as Phase 5
