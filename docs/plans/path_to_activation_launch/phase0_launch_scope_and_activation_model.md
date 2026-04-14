# Phase 0: Launch Scope And Activation Model

## Purpose

This phase locks the product story before more feature work lands.

The current system already has planning, daily execution, artifact generation, progress tracking, and a durable workflow model.
The launch problem is not lack of capability.
The launch problem is that the current setup path asks the user to do too much before the product proves value.

Phase 0 exists to stop the launch from drifting into a broad "AI homeschool platform" story.

## Outcome

At the end of Phase 0:

- the launch user is explicit
- the first-session value moment is explicit
- the first-week retention loop is explicit
- launch-critical features are separated from nice-to-have features
- native app pressure does not derail the launch
- pricing work has a clear target surface to support

## Launch Wedge

Launch around this user:

> A homeschooling parent running day-to-day instruction for a mixed-curriculum household.

Launch around this promise:

> Bring whatever you already have — chapter pages, a weekly assignment list, a photo of a table of contents, a rough outline, or just a topic — and get a clear Today, a sane next few days, and automatic records.

Do not launch around:

- full replacement curriculum for all families
- curriculum marketplace
- district or LMS integrations
- broad tutoring / workforce / certification positioning
- generic AI lesson generation without plan continuity

## Activation Model

### First-Session Value

A new household should be able to do this in one short session:

1. add one learner name
2. choose the active learner
3. provide one meaningful input
4. receive a usable Today
5. open one lesson draft
6. generate one activity
7. mark one item done, partial, skipped, or moved
8. see that tomorrow adjusts or that progress was captured

### First-Week Value

By the end of week 1, the product should have proven:

- it is easier than manual replanning
- it handles partial inputs without demanding a full curriculum upload
- it remembers what happened
- it helps the parent recover when the plan slips
- it supports more than one learner inside one household account

## Launch-Critical Principles

### 1. Today First

The product should not feel like an intake wizard with a planner attached.
It should feel like a parent can reach the day quickly and refine setup later.

### 2. Partial Inputs Are Valid Inputs

The launch user often does not have a clean export.
The product must treat incomplete material as normal, not exceptional.

### 3. Scheduling Must Respect Input Confidence

Do not stretch one day of source material into a fake week.
The system should generate only as much schedule as the source justifies.

### 4. Family Account, Learner-Centered Workspace

The paid unit is the household.
The operational unit is the active learner.

### 5. Phone-First Parent Workflow

The parent should be able to capture input, open Today, and mark progress on a phone.
That does not require a native app rewrite.
It does require mobile-first product decisions now.

## Explicit Deferrals

These are not launch blockers:

- full publisher integrations
- marketplace
- district LMS sync
- complex standards alignment
- full multimodal session intelligence
- native iOS / Android apps
- broad cross-market packaging beyond homeschooling

## Required Launch Metrics

### Activation Metrics

Track at minimum:

- sign-up started
- sign-up completed
- first learner created
- first intake submitted
- first generation completed
- first Today opened
- first lesson draft opened
- first activity generated
- first plan item status change
- time from sign-up to first Today

### Early Retention Metrics

Track at minimum:

- returned on day 2
- returned on day 7
- number of Today opens in week 1
- number of plan items marked in week 1
- number of learners added in week 1
- number of curriculum inputs added after initial setup
- tracking page viewed in week 1

### Monetization Metrics

Track at minimum:

- trial started
- billing page viewed
- converted to paid
- canceled in first 30 days
- learner count on paid households

## Decisions To Lock In This Phase

- one household plan for launch
- up to 5 learners in the launch plan unless economics force a lower cap
- no permanent free tier at launch
- responsive web is the shipping surface
- PWA polish is allowed
- native packaging is deferred until retention justifies it
- the first user-facing CTA should be a work-focused entry, not a settings-focused entry

## Suggested Implementation Order

1. write the one-sentence product promise
2. define the activation event and first-week retention events
3. define explicit deferrals
4. define the launch household plan rules
5. lock the fast-path onboarding goal
6. hand Phase 1 and Phase 2 clear constraints

## Exit Criteria

Phase 0 is complete when:

- the launch user is narrow and explicit
- the first-session value moment is explicit
- deferrals are written down
- mobile-first responsive web is confirmed as the launch surface
- pricing work has a defined household target
- later phases are optimizing one wedge, not several competing stories
