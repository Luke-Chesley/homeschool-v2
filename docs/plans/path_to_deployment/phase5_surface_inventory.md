# Phase 5: Surface Inventory

This document breaks the parent product redesign into concrete surfaces and responsibilities.

Use it to avoid redesigning pages in isolation.
The goal is to make Phase 5 broad and coherent rather than producing one polished page next to several unchanged prototype surfaces.

## Shared Surfaces

### App Shell

Primary files:

- [app/layout.tsx](/home/luke/Desktop/learning/homeschool-v2/app/layout.tsx)
- [app/(parent)/layout.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/layout.tsx>)
- [components/parent-shell](/home/luke/Desktop/learning/homeschool-v2/components/parent-shell)
- [components/navigation](/home/luke/Desktop/learning/homeschool-v2/components/navigation)

Phase 5 responsibilities:

- reduce chrome weight
- remove duplicated navigation patterns
- normalize page spacing and content width
- make learner switching and studio access feel integrated
- define the common page frame for all parent routes

Key questions:

- what must remain persistent globally
- what should become route-local instead of global
- which controls belong in the top bar versus the content area

### Shared UI Primitives

Primary files:

- [components/ui](/home/luke/Desktop/learning/homeschool-v2/components/ui)
- [app/globals.css](/home/luke/Desktop/learning/homeschool-v2/app/globals.css)

Phase 5 responsibilities:

- define typography hierarchy
- tune panel/card language
- standardize disclosure patterns
- standardize empty/loading/error states
- standardize reading-surface behavior

## Parent Route Surfaces

### Today

Primary files:

- [app/(parent)/today/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/today/page.tsx>)
- [app/(parent)/today/actions.ts](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/today/actions.ts>)
- [components/planning](/home/luke/Desktop/learning/homeschool-v2/components/planning)
- [lib/planning/today-service.ts](/home/luke/Desktop/learning/homeschool-v2/lib/planning/today-service.ts)

Why it matters:

- this is the center of the product
- if this page still feels prototype-heavy, the whole app will feel that way

Primary redesign targets:

- strengthen first-screen clarity
- create a more editorial daily surface
- reduce noise around lesson content
- make secondary controls recede
- keep “what should I do now?” obvious

### Planning

Primary files:

- [app/(parent)/planning/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/planning/page.tsx>)
- [components/planning](/home/luke/Desktop/learning/homeschool-v2/components/planning)
- [lib/planning](/home/luke/Desktop/learning/homeschool-v2/lib/planning)

Why it matters:

- this is where planning density can easily turn into clutter

Primary redesign targets:

- simplify route/day planning structure
- reduce control duplication
- improve readability of planning notes and lesson context
- keep advanced repair or setup flows visually secondary

### Curriculum

Primary files:

- [app/(parent)/curriculum/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/curriculum/page.tsx>)
- [components/curriculum](/home/luke/Desktop/learning/homeschool-v2/components/curriculum)
- [lib/curriculum](/home/luke/Desktop/learning/homeschool-v2/lib/curriculum)

Why it matters:

- curriculum can become either too document-heavy or too tool-heavy

Primary redesign targets:

- clarify browsing hierarchy
- improve long-form reading surfaces
- keep AI revise/customize features accessible without dominating the page
- remove visual fragmentation between list, detail, and action areas

### Tracking

Primary files:

- [app/(parent)/tracking/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/tracking/page.tsx>)
- [components/tracking](/home/luke/Desktop/learning/homeschool-v2/components/tracking)
- [lib/tracking](/home/luke/Desktop/learning/homeschool-v2/lib/tracking)

Why it matters:

- progress views can easily drift into generic analytics UI

Primary redesign targets:

- make the surface feel practical, not dashboard-like
- simplify status and metadata presentation
- improve readability of summaries and reports
- keep filters useful and compact

### Copilot

Primary files:

- [app/(parent)/copilot/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/copilot/page.tsx>)
- [components/copilot](/home/luke/Desktop/learning/homeschool-v2/components/copilot)
- [components/debug](/home/luke/Desktop/learning/homeschool-v2/components/debug)

Why it matters:

- Copilot can easily break the product language if it feels like a separate tool

Primary redesign targets:

- keep it chat-first
- make message reading calmer and more polished
- reduce debug/operator dominance in product mode
- maintain contextual usefulness rather than “AI feature” branding

## Supporting Parent Flows

### Onboarding

Primary files:

- [app/onboarding/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/onboarding/page.tsx)
- [lib/homeschool/onboarding](/home/luke/Desktop/learning/homeschool-v2/lib/homeschool/onboarding)

Primary redesign targets:

- calmer entry into the product
- less explanatory weight
- clearer orientation and next action

### Auth

Primary files:

- [app/auth/layout.tsx](/home/luke/Desktop/learning/homeschool-v2/app/auth/layout.tsx)
- [app/auth/login/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/auth/login/page.tsx)
- [app/auth/sign-up/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/auth/sign-up/page.tsx)
- [app/auth/setup/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/auth/setup/page.tsx)

Primary redesign targets:

- remove any utilitarian mismatch with the main product
- tighten copy
- improve polish without introducing marketing-page composition

### Users / Workspace Management

Primary files:

- [app/users/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/users/page.tsx)
- [components/users](/home/luke/Desktop/learning/homeschool-v2/components/users)

Primary redesign targets:

- keep management utility straightforward
- align visually with the rest of the shell
- avoid admin-panel heaviness

## Design Constraints To Apply Everywhere

- preserve current route behavior unless there is a clear usability reason to change it
- move secondary detail into disclosures instead of deleting it blindly
- keep studio mode accessible across redesigned surfaces
- reduce explanatory copy
- prioritize laptop scanability first
- ensure tablet usability is acceptable during the same pass

## Sequencing Guidance

Recommended order:

1. shell
2. shared primitives
3. `Today`
4. `Planning`
5. `Curriculum`
6. `Tracking`
7. `Copilot`
8. auth, onboarding, and users cleanup
9. final consistency pass

## Review Questions

Use these on every surface before signoff:

- does this page still feel like a prototype or does it feel productized
- is the primary action obvious without extra explanation
- is the content readable at laptop width
- did secondary detail get progressively disclosed rather than dumped inline
- does studio mode remain available without visually taking over
- does this surface still belong to the same product language as the others
