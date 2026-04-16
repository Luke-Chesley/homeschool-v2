# Phase 7: Product Polish And Account Surfaces

Phase 7 should finish the parts of the product that still feel obviously transitional after Phases 5 and 6.

By this point:
- the parent shell is materially redesigned
- learner routes are materially redesigned
- hosted auth and data safety are in place
- staged hosted verification is working

What still feels thin is not the platform. It is the remaining product surfaces and the consistency work between them.

This phase should make the app feel more complete and trustworthy by:
- turning `Account` into a real product surface instead of a placeholder
- tightening `Tracking` so it matches the calmer product language
- polishing auth and setup surfaces so entry, recovery, and setup feel deliberate
- standardizing the remaining component and copy patterns that still feel uneven
- closing obvious cross-surface inconsistencies before launch prep

This is not a new visual language. It should extend the same direction established in Phase 5:
- restrained chrome
- direct labels
- quiet surfaces
- strong typography hierarchy
- minimal explanatory copy
- obvious next actions

## Outcome

At the end of Phase 7, `homeschool-v2` should feel like one coherent product from:
- signed-out landing
- auth and setup
- parent workspace
- learner flow
- account/admin entry
- tracking and reporting

Users should no longer encounter placeholder-feeling pages or noticeably older layout patterns in core product routes.

## Design Constraints

Phase 7 should preserve the current product direction:

- keep the left rail and compact top bar pattern
- do not reintroduce stacked navigation bars
- do not use landing-page composition inside the app
- cut copy instead of explaining more
- prefer one clear action over multiple weak actions
- keep cards plain, small-radius, and light-touch
- keep studio/debug affordances secondary

`Account`, `Tracking`, and auth/setup should feel calmer and more complete, not more decorative.

## Primary Scope

### 1. Account Surface

Current state:
- `Account` exists as a placeholder route
- it still explicitly announces itself as a future billing/admin page
- it does not yet feel like a real product surface

Phase 7 should make it feel real even if billing is not fully implemented yet.

Required improvements:
- replace placeholder messaging with a credible household settings surface
- provide a stable structure for:
  - plan and billing summary
  - household details
  - member/access placeholders where relevant
  - support/help entry points
- keep future-only items visually secondary
- avoid fake dashboards or fake billing widgets

The page should answer:
- where do I manage the household?
- where will billing live?
- what can I control today?

### 2. Tracking Surface Polish

Current state:
- `Tracking` is functional
- some language and shell patterns are still more descriptive than needed
- it needs a stronger fit with the Phase 5 product tone

Phase 7 should:
- reduce extra explanatory copy
- tighten section rhythm and hierarchy
- make evidence, progress, and recommendations feel practical and readable
- standardize list, filter, table, and save-state behavior
- ensure no old dashboard patterns remain

`Tracking` should feel like a working review surface, not a reporting dashboard.

### 3. Auth And Setup Polish

Current state:
- auth and setup flows work
- they are structurally sound
- but they still need product-level polish and consistency work

Phase 7 should review and refine:
- `/auth/login`
- `/auth/sign-up`
- `/auth/setup`
- onboarding entry and transition states
- account recovery and error states if present

Goals:
- cleaner spacing
- clearer error handling
- consistent form rhythm
- less copy
- a stronger sense that auth/setup belongs to the same product as the main app

### 4. Cross-Surface Consistency

Phase 7 should also standardize the remaining shared behaviors across parent surfaces:

- search and filter placement
- disclosure patterns
- loading and empty states
- save-state feedback
- section headers
- action density
- table/list density
- copy tone

This should not introduce a new UI system. It should remove the remaining mismatches.

## Secondary Scope

These items belong in Phase 7 if they materially help consistency:

- modest onboarding polish
- support/help placeholders in `Account`
- FAQ/help entry placement if needed
- clearer account route placement in the top utility bar

## Out Of Scope

Do not turn Phase 7 into:

- billing backend implementation
- Stripe integration
- real subscription management
- major data-model changes
- native mobile work
- a new marketing site redesign
- launch-prep QA or rollback runbooks

If billing implementation is needed later, Phase 7 should prepare the surface for it, not build the full backend.

## Files To Read First

### Account
- [app/(parent)/account/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/account/page.tsx>)

### Tracking
- [app/(parent)/tracking/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/tracking/page.tsx>)
- [components/tracking/tracking-shell.tsx](/home/luke/Desktop/learning/homeschool-v2/components/tracking/tracking-shell.tsx)
- [components/tracking/tracking-overview.tsx](/home/luke/Desktop/learning/homeschool-v2/components/tracking/tracking-overview.tsx)
- [components/tracking/reports-view.tsx](/home/luke/Desktop/learning/homeschool-v2/components/tracking/reports-view.tsx)
- [components/tracking/attendance-card.tsx](/home/luke/Desktop/learning/homeschool-v2/components/tracking/attendance-card.tsx)

### Auth And Setup
- [app/auth/login/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/auth/login/page.tsx)
- [app/auth/sign-up/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/auth/sign-up/page.tsx)
- [app/auth/setup/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/auth/setup/page.tsx)
- [components/auth/AuthCredentialsForm.tsx](/home/luke/Desktop/learning/homeschool-v2/components/auth/AuthCredentialsForm.tsx)
- [components/auth/AuthSetupForm.tsx](/home/luke/Desktop/learning/homeschool-v2/components/auth/AuthSetupForm.tsx)
- [components/onboarding/homeschool-onboarding-form.tsx](/home/luke/Desktop/learning/homeschool-v2/components/onboarding/homeschool-onboarding-form.tsx)

### Shared Context
- [app/globals.css](/home/luke/Desktop/learning/homeschool-v2/app/globals.css)
- [components/navigation/global-page-tabs.tsx](/home/luke/Desktop/learning/homeschool-v2/components/navigation/global-page-tabs.tsx)
- [components/navigation/parent-nav.tsx](/home/luke/Desktop/learning/homeschool-v2/components/navigation/parent-nav.tsx)

## Implementation Order

1. tighten the Phase 7 visual rules and component constraints
2. turn `Account` into a real household/admin surface
3. polish `Tracking` into the Phase 5 parent language
4. refine auth/setup spacing, hierarchy, and error-state polish
5. standardize cross-surface headers, empty states, and disclosure patterns
6. run a consistency pass across `Today`, `Planning`, `Curriculum`, `Tracking`, `Copilot`, and `Account`

## Exit Criteria

Phase 7 is complete when:

- `Account` no longer feels like a placeholder
- `Tracking` feels fully aligned with the rest of the parent product
- auth/setup routes feel visually and behaviorally consistent with the app
- no major parent surface still looks like an older prototype
- the remaining product surfaces feel consistent enough that launch prep can focus on QA, not redesign

## Relationship To Phase 6

Phase 6 responsive QA can continue in parallel.

Phase 7 should not block on that review unless QA discovers issues that materially change shared layout or cross-surface component decisions.

## Follow-On

After Phase 7, the remaining major step is launch prep:
- staged QA
- product/studio QA
- responsive QA signoff
- storage verification
- rollback/recovery runbooks
