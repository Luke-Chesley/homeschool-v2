# Phase 5: Parent Product Redesign

## Purpose

This document defines the product redesign pass for the parent-facing app.

Phase 5 is not a visual reskin.
It is the point where `homeschool-v2` should stop feeling like an internal planning prototype and start feeling like a calm, premium learning studio.

This phase should preserve the current product logic, data model, and studio/debug capability while substantially improving:

- the shell and navigation model
- information density and hierarchy
- reading comfort for text-heavy educational content
- consistency across parent surfaces
- scanability on laptop and tablet widths
- confidence that the app is useful without being noisy

## Source Design Brief

The target feel for this phase is:

- calm
- premium
- sparse
- readable
- operational

The app should feel like a learning studio, not a dashboard and not a developer tool.

That means:

- restrained chrome
- strong typography
- quiet surfaces
- clear next actions
- progressive disclosure for secondary details
- rich lesson flows without oversized card stacks

The guiding aesthetic is:

- thin sticky top navigation
- clean spacing
- muted colors
- soft borders
- subtle shadows
- serif display headings
- neutral sans body text
- rounded cards used sparingly
- muted surfaces
- soft emphasis instead of loud status blocks

## What This Phase Must Achieve

At the end of Phase 5, the parent-facing product should have:

- one coherent shell language
- one coherent navigation model
- a clearly primary `Today` experience
- text-heavy lesson and planning content presented on reading surfaces instead of cramped dashboard cards
- studio/debug panels still accessible, but visually secondary and out of the default product flow
- enough consistency across `Today`, `Planning`, `Curriculum`, `Tracking`, `Copilot`, onboarding, and auth that the app feels like one product

## What This Phase Is Not

This phase is not:

- a rewrite into a new repo
- a brand-new interaction model for the core logic
- a redesign of learner activity runtime details
- a marketing landing page pass
- a dashboardification pass
- a typography experiment disconnected from usability

Do not:

- replace the app with big hero sections
- add decorative dashboard widgets
- add KPI grids, charts, or synthetic insight panels without workflow value
- move debug data back into the default surface
- create separate visual languages for each route

## Product Principles

### 1. Today Is The Center

The app should read as one product organized around the day.

`Planning`, `Curriculum`, `Tracking`, and `Copilot` should feel like supporting workspaces around `Today`, not separate products with competing page identities.

### 2. Quiet Chrome, Strong Content

The shell should be visually quiet.
The content areas should carry the feeling of quality.

That means:

- less shell ornament
- fewer persistent controls
- stronger content rhythm
- more readable surfaces

### 3. Reading Surfaces Over Card Soup

Lesson material, planning notes, curriculum context, and AI-assisted guidance should live on reading surfaces with:

- narrower text columns
- strong line-height
- clear vertical spacing
- predictable section rhythm
- meaningful callouts and examples

Do not force long educational content into repeated tiny cards.

### 4. Progressive Disclosure

Secondary detail should be collapsed by default.

This includes:

- parent/teacher notes
- setup details
- mastery indicators
- extension ideas
- route metadata
- trace/debug information

The learner-facing or parent-operational text should remain focused.

### 5. Actions Should Stay Near Content

Actions should appear where they matter.

Avoid:

- separate control dashboards
- large summary sidebars that duplicate the main flow
- detached action panels that require extra context-switching

### 6. Studio Mode Must Survive The Redesign

Phase 1 already created the product/studio split.
Phase 5 must reinforce it.

The redesigned product should feel clean in product mode, while studio mode still gives instant access to:

- prompt previews
- trace IDs
- raw payloads
- runtime diagnostics
- operator metadata

Studio mode should remain:

- additive
- quiet by default
- available without structurally changing the page

## Primary Design Goals By Surface

### Parent Shell

Goals:

- simplify the global frame
- reduce chrome weight
- preserve fast movement between core surfaces
- make the app feel stable and calm

Target characteristics:

- one thin sticky top layer
- one restrained workspace rail
- no duplicated tab stacks, banners, and section intros fighting for attention
- clearer learner-switch and studio-access placement

### Today

Goals:

- make it feel like the operational center
- surface the next useful actions immediately
- present lesson and daily content with a stronger editorial rhythm

Target characteristics:

- central daily reading surface
- obvious next steps
- compact surrounding controls
- less widget noise
- better distinction between “today’s work” and “secondary context”

### Planning

Goals:

- make the route from weekly planning to a concrete day feel calmer and more legible
- reduce state overload
- make long-form planning notes easier to read

Target characteristics:

- fewer competing control groups
- better spacing around schedules and route items
- reading-friendly day details
- secondary repair/debug tools collapsed into studio or secondary panels

### Curriculum

Goals:

- make curriculum browsing feel structured, not cluttered
- support deep reading without visual fatigue
- keep AI revision tools accessible without taking over the page

Target characteristics:

- clearer hierarchy from source to standards to details
- better document-like reading surface for source details
- quieter AI tooling entry points

### Tracking

Goals:

- make progress and reporting feel operational, not dashboard-y
- improve clarity of lists, states, and summaries
- reduce decorative data presentation

Target characteristics:

- simpler tables/lists
- clear filters and states
- less badge noise
- reporting outputs that read like useful summaries rather than analytics filler

### Copilot

Goals:

- keep it chat-first
- make it feel embedded in the product rather than like a separate “AI product”
- preserve studio insight without making that the main surface

Target characteristics:

- focused conversation area
- strong message readability
- contextual controls instead of ornamental panels
- studio metadata behind the product flow

### Auth And Onboarding

Goals:

- make entry flows feel consistent with the premium product tone
- reduce friction and visual noise
- keep copy short and confident

Target characteristics:

- lean forms
- calm structure
- no bulky explainer blocks
- better immediate orientation

## Shared UI Decisions Needed

These decisions should be made early because they affect every surface.

### Typography

Define:

- display serif for page and sectional emphasis
- neutral sans for body and UI
- predictable scale for:
  - page title
  - section title
  - body text
  - supporting metadata

Typography should do more of the hierarchy work so the layout can stay quieter.

### Spacing System

Define:

- page gutter rules
- maximum reading width
- section spacing rhythm
- compact vs standard card spacing

### Surface Language

Define:

- default panel background
- border strength
- corner radius
- shadow usage
- emphasis style for callouts and active areas

The app should feel flatter and calmer than a modern SaaS dashboard, while still reading as polished.

### Disclosure Pattern

Standardize:

- inline disclosure rows
- accordion sections
- sheet/drawer behavior for studio panels
- metadata summary blocks

### Empty, Loading, And Error States

These should be redesigned as part of the product language, not left as leftovers.

They should be:

- concise
- visually calm
- action-oriented
- consistent with the rest of the product

## Suggested Execution Order

Do not redesign every route independently in arbitrary order.
Use this order:

1. shared shell, top bar, workspace rail, and page container system
2. typography and reading-surface primitives
3. `Today`
4. `Planning`
5. `Curriculum`
6. `Tracking`
7. `Copilot`
8. auth and onboarding cleanup
9. final cross-surface polish and consistency pass

This keeps the design language coherent instead of letting each route drift.

## Acceptance Criteria

Phase 5 is complete when:

- the parent shell feels materially calmer than the current app
- `Today` clearly reads as the primary operational surface
- long-form lesson and planning content uses dedicated reading surfaces
- secondary detail is collapsed by default across the major parent surfaces
- studio mode remains accessible without polluting product mode
- `Planning`, `Curriculum`, `Tracking`, and `Copilot` all feel like parts of one product
- the app no longer feels debug-heavy, dashboard-heavy, or copy-heavy
- the product reads cleanly at common laptop widths and remains usable on tablet widths

## Explicit Deferrals

This phase does not need to fully solve:

- learner runtime redesign details
- native mobile
- launch readiness QA
- analytics instrumentation
- final production content polish

Those belong to later phases.
