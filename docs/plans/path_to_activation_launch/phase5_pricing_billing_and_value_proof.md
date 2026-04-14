# Phase 5: Pricing, Billing, And Value Proof

## Purpose

Pricing should reflect the product's seriousness, but pricing will not save weak activation.
This phase turns the launch wedge into a sellable household plan without pretending pricing itself creates retention.

## Outcome

At the end of Phase 5:

- the household plan rules are explicit
- the launch price is explicit
- billing aligns with the launch wedge
- trial or demo behavior supports fast value
- paid conversion can be measured cleanly

## Pricing Principles

### 1. Charge As A Household Product

Do not price this like a teacher tool with loose seat logic.
The paying unit is the family.

### 2. Slightly Premium Is Fine

The launch price can signal seriousness and quality.
It should not try to win on being the cheapest homeschool app.

### 3. Price Follows Value Moment

Do not force pricing before the user reaches Today and sees the system generate meaningful work.
Lead with value first.

### 4. Retention Comes From Workflow Dependence

Parents will not stay because they paid more.
They will stay because the product becomes the easiest place to run the day and recover when plans shift.

## Recommended Launch Shape

Start with:

- one household plan
- up to 5 learners
- annual default
- monthly option only if needed
- founding-customer positioning if helpful

Recommended early pricing range to test:

- $12 per month
- or $120 to $144 per year

This is high enough to avoid bargain-bin positioning and low enough to remain plausible for homeschool household software.

## Trial / Demo Recommendation

Choose one of these and test:

### Option A: Time-Limited Trial

Good when the product reaches value quickly.

Suggested shape:

- 7 to 14 day trial
- no permanent free tier
- billing prompt after first real success, not before

### Option B: Public Sample Workspace + Paid Trial

Good when users need trust before signup.

Suggested shape:

- public preview of a realistic Today / Week / Tracking flow
- signup required for custom generation
- short trial after signup

## Billing Requirements

- household plan in Stripe
- learner cap enforcement
- billing state visible in Account
- trial state visible in product
- graceful downgrade / cancellation behavior
- recovery from failed payment

## Copy Requirements

Pricing copy should emphasize:

- use what you already have
- get a clear day and a sane week
- adapt when life happens
- keep records automatically

Do not center pricing copy around:

- dependency graphs
- agentic platform language
- generic AI content generation

## Suggested Implementation Order

1. lock launch household rules
2. choose trial vs demo path
3. implement Stripe products and billing state
4. connect Account to billing status
5. instrument trial start, conversion, cancellation, and recovery
6. validate pricing with beta users before wider launch

## Exit Criteria

Phase 5 is complete when:

- the paying unit is explicit
- pricing is explicit
- trial or demo behavior is explicit
- billing is visible and testable in Account
- conversion and churn events are measurable

## Explicit Deferrals

This phase does not need to solve:

- enterprise billing
- school admin tiers
- curriculum marketplace revenue models
