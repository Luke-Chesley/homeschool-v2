# Phase 9: Billing And Stripe

Stripe is intentionally not part of Phase 7.

Phase 7 is product polish:
- `Account`
- `Tracking`
- auth/setup polish
- cross-surface consistency

The `Account` surface should prepare for billing, but it should not implement live billing yet.

## Why Stripe Is Deferred

Stripe changes the product in ways that are larger than UI polish:
- pricing model decisions
- subscription lifecycle rules
- account-state and entitlement rules
- invoice and billing-history UX
- failure and recovery flows
- cancellation and reactivation flows
- webhook handling
- production operational concerns

That work is real product and backend scope, not just account-page polish.

## Phase 9 Goal

Add a real household billing model using Stripe without destabilizing the launch-critical product work.

## Recommended Billing Shape

For this product, the likely correct starting point is:
- Stripe Billing
- Checkout Sessions for subscription signup and plan changes
- Customer Portal or an app-managed billing surface depending on how much control is needed

This should be confirmed during Phase 9 based on the actual pricing and plan model.

## Proposed Scope

### 1. Product Decisions

- define pricing and plan structure
- define trial behavior if any
- define what counts as a seat, household, or learner limit
- define what happens on cancellation, payment failure, downgrade, and reactivation

### 2. Stripe Setup

- create Stripe products and prices
- define test and production environments
- configure webhooks
- define secret and environment management

### 3. App Integration

- connect the `Account` surface to real billing state
- add subscribe / manage billing actions
- reflect billing and entitlement state in the app
- add invoice/history or customer-portal entry points

### 4. Verification

- test subscription signup
- test upgrade/downgrade
- test cancel/reactivate
- test webhook-driven state changes
- test billing failure and recovery flows

## Out Of Scope For Earlier Phases

The following should stay out of Phases 7 and 8:
- Stripe SDK integration
- real billing UI flows
- subscription entitlements
- invoice history
- webhook handling
- plan enforcement logic

## Suggested Inputs Before Starting

Before Phase 9 begins, decide:
- pricing model
- household vs learner seat model
- free tier or trial behavior
- whether billing management should be hosted via Stripe or primarily in-app

## Related Surfaces

- [app/(parent)/account/page.tsx](/home/luke/Desktop/homeschool-v2/app/(parent)/account/page.tsx)
- [docs/plans/path_to_deployment/phase7_product_polish_and_account_surfaces.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_product_polish_and_account_surfaces.md)
