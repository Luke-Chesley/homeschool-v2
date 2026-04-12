# Phase 5: Checklist Design Review

This document records the relevant guidance pulled from [Checklist Design browse](https://www.checklist.design/browse) and maps it into the `homeschool-v2` redesign scope.

The goal is not to copy generic SaaS patterns blindly.
The goal is to make sure the redesign covers the important flows, components, and states that often get missed when a product moves from prototype to polished app.

## How To Use This Review

Treat this document as a coverage map.

For each applicable checklist area:

- decide where it appears in `homeschool-v2`
- decide whether it belongs in Phase 5 now, a later phase, or a launch-prep deferral
- make sure the relevant requirement is reflected in the redesign checklist

## Overall Interpretation

Checklist Design is strongest here as a completeness tool.
It helps make sure the redesign covers:

- auth entry and account recovery
- search and filtering
- disclosure and detail patterns
- loading, save, and error feedback
- data-heavy surfaces like tables
- supporting flows like verification and media upload

Some checklist areas are directly relevant now.
Some are relevant later but not part of the current product surface.

## Apply In Phase 5 Now

### Website Pages

#### Login

Apply to:

- [app/auth/login/page.tsx](/home/luke/Desktop/homeschool-v2/app/auth/login/page.tsx)

Key Phase 5 implications:

- keep brand identity visible but restrained
- make the page purpose obvious immediately
- keep account identifier and password inputs clear
- keep reset-password access near the password field
- keep sign-up access obvious but secondary
- avoid decorative promo content that distracts from sign-in

Reference:

- https://www.checklist.design/website/login-page

#### Sign up

Apply to:

- [app/auth/sign-up/page.tsx](/home/luke/Desktop/homeschool-v2/app/auth/sign-up/page.tsx)
- [app/auth/setup/page.tsx](/home/luke/Desktop/homeschool-v2/app/auth/setup/page.tsx)

Key Phase 5 implications:

- explain the value of account creation briefly, not with heavy marketing copy
- set clear expectations about what happens after sign-up
- keep account identification and password steps lean
- make verification/setup flow feel continuous rather than fragmented

Reference:

- https://www.checklist.design/website/sign-up

#### Search

Apply to:

- curriculum browsing
- tracking/report lists
- users/workspace management where relevant

Key Phase 5 implications:

- search should live near the collection it affects
- search styling should stay consistent across the app
- placeholders should help, not narrate
- autocomplete or suggestion behavior should be considered where data density justifies it

Reference:

- https://www.checklist.design/website/search

#### FAQ

Apply to:

- onboarding help
- auth/setup support copy
- future parent-help surfaces

Key Phase 5 implications:

- if explanatory content exists, it should be purposeful and decision-oriented
- unresolved questions should point to a clearer support path
- disclosure patterns should be strong enough that inline help does not become clutter

Reference:

- https://www.checklist.design/website/faq

### Components

#### Navigation

Apply to:

- parent shell
- learner shell
- route-local secondary navigation if any remains

Key Phase 5 implications:

- keep top-level structure shallow
- differentiate primary navigation from any secondary navigation
- keep location and hierarchy consistent across routes
- avoid more than two effective levels of nav hierarchy

Reference:

- https://www.checklist.design/components/navigation

#### Accordion

Apply to:

- FAQ/help patterns
- curriculum detail disclosures
- parent notes, extension ideas, mastery indicators, and other secondary detail

Key Phase 5 implications:

- use clear headers that explain hidden content
- make disclosure a first-class pattern across product mode
- avoid dumping secondary context inline

Reference:

- https://www.checklist.design/components/accordion

#### Drawer

Apply to:

- studio panels
- route-local detail views
- filters or secondary setup panels when inline presentation would clutter the page

Key Phase 5 implications:

- choose drawer placement intentionally
- keep drawers wide enough for useful content but not page-dominating
- always support clear close patterns
- ensure scrolling behavior inside the drawer remains usable

Reference:

- https://www.checklist.design/components/drawer

#### Input Field

Apply to:

- auth
- onboarding
- copilot input
- search/filter inputs
- editable planning and curriculum forms

Key Phase 5 implications:

- inputs need a consistent visual language
- labels, placeholders, helper text, and error text must be standardized
- form density should be reduced without losing clarity

Reference:

- https://www.checklist.design/components/input-field

#### Table

Apply to:

- tracking lists
- users/workspace management
- any structured admin-like lists that remain in product mode

Key Phase 5 implications:

- make headers clear and persistent enough to preserve context
- reduce row noise and excessive borders
- preserve readability at laptop widths

Reference:

- https://www.checklist.design/components/table

#### Tabs

Apply to:

- route-local organization only where clearly justified

Key Phase 5 implications:

- tabs should separate related content within one surface
- tabs should not recreate duplicated global navigation
- use tabs sparingly and only for clearly related sections

Reference:

- https://www.checklist.design/components/tabs

#### Toast

Apply to:

- save/update confirmation
- copy confirmations
- success/error feedback for non-blocking actions

Key Phase 5 implications:

- keep copy short and specific
- make toasts informative but non-disruptive
- do not rely on color alone for meaning

Reference:

- https://www.checklist.design/components/toast

#### Modal

Apply to:

- destructive confirmations
- irreversible actions
- occasional focused decisions

Key Phase 5 implications:

- keep modal use rare
- reserve it for decisions that truly need interruption
- prefer drawers or inline disclosure for inspectable detail

Reference:

- https://www.checklist.design/components/modal

#### Searchbar

Apply to:

- curriculum
- tracking
- future searchable content surfaces

Key Phase 5 implications:

- search affordance must be obvious
- placeholder text should provide useful examples
- suggestions and quick links should be considered where appropriate

Reference:

- https://www.checklist.design/components/searchbar

#### Loading

Apply to:

- auth transitions
- `Today` content loads
- curriculum and planning fetches
- copilot pending states
- upload/save flows

Key Phase 5 implications:

- loading states should be specific, not generic when possible
- skeletons and subtle placeholders are better than blank areas
- do not overuse loading UI for fast transitions

Reference:

- https://www.checklist.design/components/loading

### Flows

#### Submitting a form

Apply to:

- auth
- onboarding
- planning and curriculum forms

Key Phase 5 implications:

- submit actions should be obvious
- submission must show a loading state
- copy should match the action rather than always saying “submit”

Reference:

- https://www.checklist.design/flows/submitting-a-form

#### Showing input error

Apply to:

- auth
- onboarding
- all editable forms

Key Phase 5 implications:

- don’t aggressively validate while the user is still typing
- errors should appear at the right moment and clearly explain the problem
- error styling should be standardized across the app

Reference:

- https://www.checklist.design/flows/showing-input-error

#### Saving changes

Apply to:

- any editable settings or preference surface
- future curriculum/planning edit experiences

Key Phase 5 implications:

- save actions should be visible and understandable
- disabled/unavailable save states must be communicated clearly
- save confirmations should be calm and consistent

Reference:

- https://www.checklist.design/flows/saving-changes

#### Resetting password

Apply to:

- auth flow

Key Phase 5 implications:

- keep recovery close to the password field
- make recovery feel straightforward and trustworthy

Reference:

- https://www.checklist.design/flows/resetting-password

#### Filtering items

Apply to:

- curriculum collections
- tracking lists
- future searchable/filterable parent views

Key Phase 5 implications:

- filter controls should live close to the collection they affect
- filter types should match the data being filtered
- avoid sending users to a separate management surface unless the filter complexity truly requires it

Reference:

- https://www.checklist.design/flows/filtering-items

#### Uploading media

Apply to:

- hosted storage and evidence flows
- future attachment uploads

Key Phase 5 implications:

- make empty and drop states clear
- show progress when uploads take time
- keep upload feedback concise and visible

Reference:

- https://www.checklist.design/flows/uploading-media

#### Verifying account

Apply to:

- sign-up and confirmation flow

Key Phase 5 implications:

- explain why verification is needed
- confirm where the code or link was sent
- let the user see and fix incorrect contact details

Reference:

- https://www.checklist.design/flows/verifying-account

## Relevant, But Not Phase 5 Core Scope

These are worth keeping in the long-term product backlog, but they are not central to the current parent redesign pass.

### Pricing

This is relevant if the product adds public-facing plan selection or monetization later.
Not a Phase 5 requirement for the current authenticated product shell.

Reference:

- https://www.checklist.design/website/pricing

### Billing

Relevant later if the app exposes a household billing/settings surface.
Not a Phase 5 parent redesign blocker today.

Reference:

- https://www.checklist.design/website/billing

### Cart

Not relevant to the current product shape.
Do not force ecommerce patterns into Phase 5.

Reference:

- https://www.checklist.design/website/cart

### Payment, Promo Code, Add To Cart, Cancel Subscription

These flows are later monetization/billing concerns.
Do not pollute the current redesign scope with them.

References:

- https://www.checklist.design/flows/making-a-card-payment
- https://www.checklist.design/flows/entering-a-promo-code
- https://www.checklist.design/flows/adding-to-cart
- https://www.checklist.design/flows/canceling-subscription

## Phase 5 Coverage Additions

As a result of this review, Phase 5 should explicitly include:

- auth and setup polish informed by login, sign-up, reset-password, and verification guidance
- standardized search, filter, and disclosure behavior across parent surfaces
- stronger component standards for navigation, drawer, accordion, input, table, tabs, toast, modal, searchbar, and loading
- explicit form-state handling for submit, save, loading, and input-error states
- upload/evidence flow polish hooks even if the full hosted storage verification happens in launch prep

## What This Changes In Practice

The redesign should not only make pages prettier.
It should also remove the current prototype feel in all the small places users actually notice:

- vague auth screens
- inconsistent form states
- cluttered filter/search affordances
- overly noisy metadata
- weak empty/loading/error feedback
- disclosure patterns that are not yet standardized

That is the main value of applying the checklist.design review here.
