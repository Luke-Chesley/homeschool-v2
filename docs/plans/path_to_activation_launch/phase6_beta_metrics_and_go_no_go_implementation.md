# Phase 6: Beta, Metrics, And Go / No-Go Implementation

## Purpose

This document turns Phase 6 into concrete execution work for the current repo.

The product plans already define the beta questions and success thresholds.
The codebase now has most of the product behaviors those questions depend on:

- fast-path onboarding and first-Today activation events
- learner switching and second-learner creation
- mobile-first parent runtime improvements
- household billing state and billing-intent events

What the repo does not yet have is a trustworthy beta operations layer.
Today, `lib/platform/observability.ts` only logs events to the console.
That is enough for local debugging, but not enough for beta analysis, scorecards, or go / no-go decisions.

Phase 6 should therefore focus on making launch evidence durable, reviewable, and operational.

## Current State

### What Already Exists

- `lib/homeschool/onboarding/activation-contracts.ts` defines most of the activation, retention, and billing-intent event names needed for launch analysis
- onboarding and household flows already emit events through `trackProductEvent`
- Phase 5 now adds billing-offer, trial, checkout, and subscription lifecycle event names
- the parent product surfaces are close enough to launch shape that a real beta can exercise the actual wedge rather than a prototype

### What Is Missing

- durable event persistence
- cohort tagging for beta households
- a simple beta scorecard source of truth
- event-to-metric rollups for activation and week-1 retention
- written operating rules for recruiting, support, and launch review
- a repo-local place to record the final go / no-go decision

That means Phase 6 should not start with recruiting families.
It should start by making sure evidence survives beyond the terminal scrollback.

## Phase 6 Outcome

At the end of this phase:

- beta households are explicitly tagged
- activation, retention, and billing-intent events are durably recorded
- the team has one repeatable scorecard for each household and for the cohort overall
- the beta review can distinguish product failure from instrumentation failure
- a written go / no-go decision can be made from the staged and hosted product, not from memory

## Product And Operations Decisions To Lock

### One Beta Cohort, Not Multiple Competing Definitions

The repo needs one explicit beta household definition.

Recommended launch contract:

- 15 to 25 real households
- mixed curriculum inputs
- parent actively running day-to-day instruction
- at least occasional plan drift
- willingness to use the product more than once in one week

Do not mix in broad “friends and family” signups that do not match the wedge.

### Two Measurement Modes

The repo-fit review already points to two viable beta modes.
Phase 6 should lock them explicitly:

- Mode A: no live Stripe conversion, measure willingness-to-pay intent and founder commitments
- Mode B: live Stripe, measure trial start, conversion, cancellation, and recovery

Do not blend the two modes in one scorecard without labeling them.

### Hosted Environment Is The Truth Source

Launch decisions should be based on the hosted stack, not only localhost.

For Phase 6:

- staged or production-like Vercel + Supabase behavior is the source of truth
- localhost remains useful for debugging instrumentation and QA reproduction
- the final scorecard should label which environment produced the evidence

## Existing Repo Seams To Use

### Event Contracts

Primary file:

- `lib/homeschool/onboarding/activation-contracts.ts`

Current reality:

- this already contains event names for onboarding, learner switching, retention, and billing intent

Phase 6 should extend this file only when a required beta metric has no existing event.
Do not introduce a second launch metrics registry.

### Observability

Primary file:

- `lib/platform/observability.ts`

Current reality:

- `trackProductEvent` and `trackOperationalError` only emit `console.info` and `console.error`

Phase 6 should replace or augment that with durable persistence.

### Household And Session Context

Primary files:

- `lib/app-session/server.ts`
- `app/api/app-session/route.ts`
- `app/api/users/route.ts`
- `lib/users/service.ts`

Current reality:

- organization ID and learner ID are already present across the product paths that matter

That is enough to make household-level and learner-level beta rollups possible without inventing a second identity layer.

### Billing And Intent Signals

Primary files:

- `lib/billing/`
- `app/api/billing/*`
- `components/account/BillingOfferViewTracker.tsx`

Current reality:

- Mode B conversion signals are now possible if Stripe is configured
- Mode A intent signals are possible even when live billing is not enabled

## Implementation Strategy

### Workstream 1: Make Product Events Durable

This is the first blocking step for Phase 6.

Required behavior:

- every launch-critical event written through `trackProductEvent` should be durably stored
- the stored event should include:
  - event name
  - organization ID
  - learner ID when relevant
  - metadata payload
  - created-at timestamp

Recommended repo shape:

- add a lightweight product-events table under `lib/db/schema/`
- add repository methods under `lib/db/repositories/`
- update `trackProductEvent` to write to persistence in server contexts while keeping console logging for local visibility

Launch-safe rule:

- prefer one append-only event log
- do not build a full analytics vendor abstraction layer first

### Workstream 2: Tag And Track The Beta Cohort

Phase 6 needs a durable way to know which households count toward the beta.

Recommended launch-safe shape:

- store beta-cohort metadata on `organizations.metadata`
- include:
  - beta enrollment status
  - recruitment source
  - cohort label
  - measurement mode (`intent_only` or `live_billing`)
  - notes or support flags if needed

Primary surfaces:

- admin-safe script or direct repo utility for tagging households
- optional account/internal-only display if useful later

Do not build a public-facing “apply for beta” workflow first unless launch recruiting truly depends on it.

### Workstream 3: Define The Scorecard Aggregates

The raw event log is not enough.
Phase 6 needs one canonical way to derive the launch metrics.

Required rollups:

- sign-up to first Today time
- first-Today completion rate
- first-session plan item status change rate
- day-2 return
- day-7 return
- week-1 Today opens
- week-1 second learner additions
- week-1 additional curriculum activity
- billing-offer views
- trial starts
- checkout starts
- paid conversion or founder-intent equivalent

Recommended repo shape:

- one service under `lib/launch-readiness/` or `lib/beta/`
- deterministic rollups from the durable event log
- output shaped for both per-household detail and cohort summary

Do not scatter metric logic across many pages or scripts.

### Workstream 4: Add A Beta Review Artifact

The repo should contain a written scorecard format for each review cycle.

Recommended artifacts:

- `docs/beta/scorecards/<date>-beta-review.md`
- one reusable template for:
  - cohort size
  - environment used
  - activation results
  - week-1 retention
  - monetization mode and results
  - top friction points
  - launch blockers
  - go / no-go recommendation

This keeps the decision durable and reviewable in git.

### Workstream 5: Add QA And Support Operating Rules

The beta is not only analytics.
The team needs a repeatable operating rhythm.

Required rules:

- how beta households are recruited
- how support issues are captured
- how regressions are triaged during beta
- how often the scorecard is reviewed
- what counts as a blocker vs a known rough edge

Recommended repo shape:

- a small beta operations doc under `docs/qa/` or `docs/beta/`
- one support / issue intake template

### Workstream 6: Write The Go / No-Go Decision Contract

The final decision should be explicit before the cohort begins.

Required outputs:

- written go thresholds
- written no-go triggers
- written “iterate and retest” fallback path
- named owner for the final decision write-up

Recommended repo artifact:

- `docs/beta/go-no-go-template.md`

Do not leave the final decision as a meeting memory.

## Data Contract For Beta Evidence

Phase 6 should define the minimum event metadata required for trustworthy rollups.

Recommended metadata fields:

- `source`
  - `onboarding`
  - `today`
  - `planning`
  - `curriculum`
  - `tracking`
  - `account`
- `environment`
  - `local`
  - `staging`
  - `production`
- `betaMode`
  - `intent_only`
  - `live_billing`
- `organizationId`
- `learnerId` when relevant

Do not make every event schema huge.
Only add metadata necessary for scorecard clarity.

## Metric Mapping To Existing Events

The repo is already close to the needed instrumentation.

### Activation

- `onboarding_started`
- `generation_started`
- `generation_completed`
- `first_today_opened`
- `first_plan_item_status_change`

Potential additions still worth considering:

- lesson draft opened
- activity opened

### Week-1 Retention

- `returned_day_2`
- `returned_day_7`
- `active_learner_switched`
- `second_learner_created`

Potential additions still worth considering:

- additional curriculum source added in week 1
- weekly route regenerated or edited in week 1

### Monetization

- `billing_offer_viewed`
- `trial_started`
- `checkout_started`
- `checkout_completed`
- `subscription_activated`
- `subscription_payment_failed`
- `subscription_canceled`
- `subscription_reactivated`

Mode A note:

If Stripe is not live, add one explicit founder-intent event or manual scorecard field so willingness-to-pay does not disappear from the evidence model.

## QA Contract

Before recruiting beta households, Phase 6 should require one hosted QA pass across the core wedge:

- `/onboarding`
- `/today`
- `/planning`
- `/curriculum`
- `/tracking`
- `/account`
- learner switching
- billing summary state

Required hosted checks:

- first-Today activation flow
- one plan item status change
- second learner add and switch
- billing-offer visibility after activation
- trial or intent flow for the chosen beta mode

This should reuse the existing QA discipline from the deployment track instead of inventing a separate beta QA style.

## Suggested PR Slices

### PR 1: Durable Event Log

- add schema and repository for product events
- update `trackProductEvent`

### PR 2: Beta Cohort Tagging And Rollup Service

- add organization beta metadata contract
- add rollup service for activation and week-1 metrics

### PR 3: Scorecard Templates And Review Docs

- add reusable beta scorecard template
- add go / no-go decision template
- add beta operations doc

### PR 4: Final Event Gaps

- add any missing activation or monetization events discovered during dry-run review

Do not mix persistence, cohort ops, and final decision docs into one oversized PR if the work starts moving quickly.

## Exit Criteria

Phase 6 is complete when:

- launch-critical events are durably persisted
- beta households are explicitly tagged
- activation, retention, and monetization rollups can be generated without manual log scraping
- beta review artifacts exist in-repo
- hosted beta QA has been run
- a written go / no-go decision can be produced from the scorecard

## Explicit Deferrals

Phase 6 does not need:

- a full BI warehouse
- third-party analytics vendor migration
- public dashboards
- broad growth funnels outside the launch wedge
- a self-serve beta signup system unless recruiting actually requires it
