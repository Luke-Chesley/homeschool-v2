# Phase 7: Surface Inventory

Use this inventory to keep Phase 7 focused on the real remaining product surfaces instead of treating “polish” as an unbounded cleanup pass.

## Primary Surface Groups

### Account

Route:
- [app/(parent)/account/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/account/page.tsx>)

Current state:
- obvious placeholder framing
- future-billing messaging is too explicit
- does not yet feel like a stable household settings surface

Phase 7 goals:
- make it feel real now
- leave room for future billing/admin features
- anchor the household-management part of the product

### Tracking

Route:
- [app/(parent)/tracking/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/tracking/page.tsx>)

Components:
- [components/tracking/tracking-shell.tsx](/home/luke/Desktop/learning/homeschool-v2/components/tracking/tracking-shell.tsx)
- [components/tracking/tracking-overview.tsx](/home/luke/Desktop/learning/homeschool-v2/components/tracking/tracking-overview.tsx)
- [components/tracking/reports-view.tsx](/home/luke/Desktop/learning/homeschool-v2/components/tracking/reports-view.tsx)
- [components/tracking/attendance-card.tsx](/home/luke/Desktop/learning/homeschool-v2/components/tracking/attendance-card.tsx)

Current state:
- functionally useful
- still somewhat more descriptive and transitional than the rest of the redesigned parent product

Phase 7 goals:
- strengthen hierarchy
- reduce explanatory weight
- standardize density and section rhythm

### Auth And Setup

Routes:
- [app/auth/login/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/auth/login/page.tsx)
- [app/auth/sign-up/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/auth/sign-up/page.tsx)
- [app/auth/setup/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/auth/setup/page.tsx)
- [app/onboarding/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/onboarding/page.tsx)

Components:
- [components/auth/AuthCredentialsForm.tsx](/home/luke/Desktop/learning/homeschool-v2/components/auth/AuthCredentialsForm.tsx)
- [components/auth/AuthSetupForm.tsx](/home/luke/Desktop/learning/homeschool-v2/components/auth/AuthSetupForm.tsx)
- [components/onboarding/homeschool-onboarding-form.tsx](/home/luke/Desktop/learning/homeschool-v2/components/onboarding/homeschool-onboarding-form.tsx)

Current state:
- structurally sound
- still needs visual and copy consistency polish

Phase 7 goals:
- stronger rhythm
- less copy
- clearer error and recovery states

## Cross-Surface Review Set

These routes should be reviewed during Phase 7 for consistency, even if they are not deeply rebuilt:

- [app/(parent)/today/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/today/page.tsx>)
- [app/(parent)/planning/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/planning/page.tsx>)
- [app/(parent)/curriculum/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/curriculum/page.tsx>)
- [app/(parent)/copilot/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/copilot/page.tsx>)
- [app/(parent)/tracking/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/tracking/page.tsx>)
- [app/(parent)/account/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/account/page.tsx>)

Review goals:
- no route should feel like a different product
- no route should have a noticeably older header pattern
- no route should use overly descriptive explanatory text
- no route should reintroduce dashboard filler

## Shared Systems

These shared files matter because Phase 7 is partly a consistency pass:

- [app/globals.css](/home/luke/Desktop/learning/homeschool-v2/app/globals.css)
- [components/navigation/global-page-tabs.tsx](/home/luke/Desktop/learning/homeschool-v2/components/navigation/global-page-tabs.tsx)
- [components/navigation/parent-nav.tsx](/home/luke/Desktop/learning/homeschool-v2/components/navigation/parent-nav.tsx)

Adjust these only if the change clearly improves cross-surface consistency.

## Explicit Non-Goals

Phase 7 should not absorb:
- Stripe implementation
- live billing backend work
- major learner redesign work
- Phase 6 responsive QA itself
- launch-prep verification and rollback work
