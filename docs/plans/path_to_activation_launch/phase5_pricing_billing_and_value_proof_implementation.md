# Phase 5: Pricing, Billing, And Value Proof Implementation

## Purpose

This document turns Phase 5 into concrete implementation work for the current repo.

The launch plans already say pricing should follow value, not lead it.
The codebase already reflects that choice:

- `app/(parent)/account/page.tsx` has a billing placeholder, not fake billing UI
- `docs/plans/path_to_deployment/phase9_billing_and_stripe.md` defers Stripe until product shape is clear
- `lib/platform/observability.ts` and `lib/homeschool/onboarding/activation-contracts.ts` already give the repo a simple event seam for launch metrics

Phase 5 should now define the real household billing model, wire the minimum product surfaces for it, and make willingness-to-pay measurable without overbuilding a broad subscription platform.

## Current State

The repo is well-positioned for Phase 5 in product structure, but not in billing implementation.

What already exists:

- a household account model with one active learner at a time
- an `Account` surface that already speaks in household terms
- activation instrumentation for onboarding and early retention events
- explicit deployment-track guidance that Stripe belongs in a dedicated billing phase

What does not exist yet:

- Stripe SDK integration
- subscription state stored in the app
- checkout, trial, or portal entry points
- entitlement enforcement for learner caps or billing state
- billing-specific events for trial, conversion, cancellation, or recovery

That means Phase 5 should not start by styling a nicer billing card.
It should start by locking the actual billing contract.

## Phase 5 Outcome

At the end of this phase:

- the paid unit is one household
- the launch plan and learner cap are explicit
- trial behavior is explicit
- Stripe has a narrow launch-safe integration shape
- `Account` shows real billing state instead of placeholder copy
- the app can measure trial start, conversion intent, paid conversion, cancellation, and recovery
- Phase 6 can evaluate willingness to pay using real product events instead of interviews alone

## Product Decisions To Lock

### Household Is The Paying Unit

Do not introduce seat-style billing for launch.

For launch:

- one subscription belongs to one household organization
- one household can operate multiple learners
- learner switching stays operational, not billable per workspace tab
- the learner cap is enforced at the household level

Recommended launch contract:

- one founding household plan
- up to 5 active learners
- archived learners do not count toward the cap

### Trial Starts After Value, Not Before

Phase 1 through Phase 4 were built to get the parent to Today quickly.
Phase 5 should preserve that.

Recommended launch contract:

- no payment wall before first successful Today generation
- show upgrade or trial CTA only after first activation success
- default to a short trial rather than a permanent free tier

Recommended first pass:

- 7-day trial
- no card required before first Today
- card collected at checkout when starting the trial or converting, depending on the exact Stripe mode chosen

### Keep Pricing Narrow

Launch with one plan, not a pricing table full of future product fantasies.

Recommended first pass:

- one founding household plan
- annual default
- optional monthly plan only if beta households push back on annual-only pricing

### Hosted Billing Management Is Good Enough

The deployment plan already points toward Stripe Checkout and Stripe Customer Portal.
That is the right launch-safe shape.

For launch:

- use Stripe Checkout Sessions for subscribe and plan-change entry
- use Stripe Customer Portal for payment method, invoices, cancellation, and reactivation
- keep the in-app `Account` surface as a clear summary and entry point, not a custom billing console

Do not build invoice tables, payment-method editors, or custom cancellation flows first.

## Existing Repo Seams To Use

### Household Account Surface

Primary file:

- `app/(parent)/account/page.tsx`

Current reality:

- the page already presents the household, active learner, and learner roster
- the billing area is explicitly a placeholder

Phase 5 should replace placeholder language with real billing state and clear actions:

- current plan
- trial or paid status
- renewal or trial-end date
- learner cap status
- subscribe / manage billing entry points

### Observability

Primary files:

- `lib/platform/observability.ts`
- `lib/homeschool/onboarding/activation-contracts.ts`

Current reality:

- product events are already emitted through a simple shared helper
- activation and week-1 event naming already exists

Phase 5 should extend this seam instead of inventing a second analytics path.

### Household And Learner State

Primary files:

- `lib/app-session/server.ts`
- `app/api/app-session/route.ts`
- `app/api/users/route.ts`
- `lib/users/service.ts`

Current reality:

- the organization and learner model already exist
- learner count and active learner logic can support launch billing enforcement

Phase 5 should attach billing to the organization, not to individual learners.

## Billing Model Contract

Phase 5 needs a first-class app-side billing model before touching UI.

Recommended app contract:

- organization-level billing record
- Stripe customer ID
- Stripe subscription ID
- plan key
- billing status
- trial status
- current period end
- trial end
- learner cap
- cancel-at-period-end flag

Recommended status vocabulary:

- `trialing`
- `active`
- `past_due`
- `canceled`
- `incomplete`
- `unpaid`
- `none`

Recommended ownership model:

- billing belongs to `organization`
- entitlements are derived from billing state
- learner creation checks entitlement rules at the organization boundary

## Implementation Strategy

### Workstream 1: Lock The Launch Billing Contract

Define the product rules in code-facing terms before adding Stripe calls.

Required decisions:

- exact launch plan key and display name
- exact learner cap
- exact trial behavior
- whether monthly pricing exists at launch
- whether archived learners count toward cap
- what happens when a household is over cap after downgrade or payment failure

Recommended behavior:

- block creation of new active learners when over cap
- do not silently archive learners
- preserve read access to household history during grace or recovery states

Primary output:

- a small billing domain module under `lib/billing/`
- explicit plan and entitlement constants

### Workstream 2: Add Stripe As A Narrow Backend Integration

Keep launch scope tight.

Recommended first-pass Stripe shape:

- Stripe Billing subscriptions
- Checkout Session for subscribe
- Customer Portal session for manage billing
- webhooks for subscription lifecycle synchronization

Primary files to add:

- `lib/billing/` domain files
- server actions or API routes for:
  - create checkout session
  - create portal session
- webhook route for Stripe subscription events

Recommended webhook coverage:

- checkout completion
- subscription created or updated
- subscription canceled
- invoice payment failed
- invoice paid

Do not mix coupon systems, usage-based billing, or multi-plan migration work into the first slice.

### Workstream 3: Replace The Account Placeholder With Real Billing Summary

Update `app/(parent)/account/page.tsx` so it reflects the real household plan state.

Required behavior:

- if no subscription exists, show the launch offer and subscribe CTA
- if trialing, show trial state and trial end date
- if active, show plan name, renewal date, learner cap, and manage billing CTA
- if past due, show a recovery-oriented warning and manage billing CTA
- if canceled, show access state and reactivation path

UI rules:

- keep the section plain and operational
- no pricing comparison matrix inside the app
- no fake invoice history if that still lives in Customer Portal

### Workstream 4: Enforce Household Entitlements In Product Flows

Phase 5 is incomplete if billing exists only on the account page.

Primary enforcement points:

- learner creation
- household plan summary
- trial status visibility
- future paid-only gates if introduced later

Recommended first-pass enforcement:

- learner cap enforced in `app/api/users/route.ts` through a billing service check
- account surface clearly explains remaining learner capacity
- no aggressive gating across Today, Planning, Curriculum, or Tracking during launch beta unless the household is fully inactive

Keep the operational product usable enough that recovery is possible.

### Workstream 5: Add Billing And Monetization Events

Phase 6 depends on real willingness-to-pay signals.

Add billing event names alongside existing activation contracts.

Recommended events:

- `billing_offer_viewed`
- `trial_started`
- `checkout_started`
- `checkout_completed`
- `subscription_activated`
- `subscription_payment_failed`
- `billing_portal_opened`
- `subscription_canceled`
- `subscription_reactivated`

Recommended metadata:

- organization ID
- learner count at event time
- plan key
- billing status
- trial days remaining if applicable
- source surface such as `account`, `today`, or `post_activation_prompt`

### Workstream 6: Connect Phase 5 To Phase 6 Value Proof

If billing is not yet live for every beta household, Phase 5 still needs a measurable intent path.

Recommended fallback:

- instrument billing-offer views
- instrument checkout starts
- capture “interested in founding plan” intent if live conversion is disabled for a cohort

Phase 6 should then read monetization in one of two modes:

- live Stripe mode: real trial and paid conversion events
- intent mode: strong willingness-to-pay signals with a manual founder commitment path

## Data And Schema Expectations

Before implementation, confirm where the billing record belongs in the current DB model.

Likely requirements:

- organization billing table or organization billing columns
- Stripe identifiers stored server-side
- subscription status timestamps
- webhook event idempotency handling

Keep this scoped to launch needs.
Do not design a generalized B2B entitlement framework.

## QA Contract

Phase 5 needs explicit verification, not just typecheck.

Minimum test matrix:

- household with no subscription can start checkout
- successful checkout updates app billing state
- trialing household sees correct trial copy and dates
- active household can open Customer Portal
- past-due household sees recovery messaging
- canceled household sees reactivation path
- learner creation respects learner cap
- archived learners do not count toward the cap

Browser routes to verify:

- `/account`
- `/users`
- any surface that shows a post-activation billing CTA

Webhook cases to verify:

- first subscription activation
- failed renewal
- cancellation at period end
- successful recovery after failed payment

## Suggested PR Slices

Keep Phase 5 split into small reviewable slices.

### PR 1: Billing Domain Contract

- add `lib/billing/` types and plan constants
- add billing status model
- extend analytics event names
- leave UI unchanged

### PR 2: Stripe Backend Wiring

- add checkout and portal routes
- add webhook handling
- persist billing state

### PR 3: Account Billing Summary

- replace placeholder billing section in `/account`
- show real billing state and actions

### PR 4: Learner Cap Enforcement And Recovery UX

- enforce learner cap on add-learner flow
- add recovery messaging for past-due and canceled households

### PR 5: Beta Monetization Measurement

- wire post-activation offer presentation
- verify monetization events for Phase 6 scorecard

Do not combine all of this into one large Stripe PR.

## Exit Criteria

Phase 5 is complete when:

- one household billing model is explicit in code and product copy
- Stripe integration is live in the narrow launch-safe shape
- `Account` shows real billing state
- learner cap behavior is explicit and testable
- trial, conversion, cancellation, and recovery are measurable
- Phase 6 can evaluate willingness to pay from product evidence instead of assumption

## Explicit Deferrals

Phase 5 does not need:

- school or admin plans
- add-on pricing
- per-learner seat billing
- custom invoice history UI if Customer Portal covers it
- coupon experimentation engine
- marketplace or revenue-share billing
