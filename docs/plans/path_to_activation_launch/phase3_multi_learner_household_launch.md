# Phase 3: Multi-Learner Household Launch

## Purpose

The paid unit is the family account, but the operational unit is the active learner.
This phase makes that distinction clean in the product.

The launch user should feel like the product supports a household from day 1 without forcing a giant family setup ceremony.

## Outcome

At the end of Phase 3:

- family accounts are first-class
- the first learner can activate fast
- additional learners can be added with low friction
- each learner has independent Today, planning, curriculum, and tracking state
- switching learners is fast on phone and desktop

## Product Rules

### 1. First Learner First

Do not require all children to be configured before the product proves value.
The first learner should be enough to activate the household.

### 2. Active Learner Workspace

Keep one learner active at a time in the main parent workspace.
Do not try to merge all children into one complicated launch surface.

### 3. Household Features Should Support, Not Block

Shared defaults, scheduling preferences, and reporting settings matter, but they should come after the first learner reaches Today.

## Launch-Critical Work

### Fast Add Another Learner

The product should support:

- add learner from Account or Today
- choose whether to copy household defaults
- choose whether to start from a new input or a starter shell
- set active learner immediately after creation

### Clear Learner Switching

The parent should be able to:

- see which learner is active
- switch learners in one or two taps
- understand that Today belongs to the active learner

### Per-Learner Independence

Each learner should have independent:

- curriculum source state
- plan generation state
- Today workspace
- progress records
- evidence and activities

### Household Billing Alignment

The eventual billing model should map cleanly to this structure:

- one paying household
- learner cap on the plan
- no per-seat enterprise complexity for v1

## Recommended UX Shape

- household account at the top level
- active learner switcher in the main shell
- lightweight learner cards in Account
- fast-add learner CTA after first success
- optional household defaults editor separated from learner-specific inputs

## Recommended Technical Work

- verify workspace cookies and active learner selection behave cleanly across routes
- audit onboarding and generation code for assumptions that the first learner is the only learner
- ensure curriculum and planning creation APIs remain learner-scoped where needed
- add analytics for second learner creation and learner switching

## Suggested Implementation Order

1. verify the current active-learner model under real multi-learner use
2. add post-activation "add learner" flow
3. harden learner switching in the parent shell
4. test per-learner isolation across Today, Planning, Curriculum, and Tracking
5. align billing assumptions with household caps

## Exit Criteria

Phase 3 is complete when:

- a new household can activate with one learner
- a second learner can be added without confusing the first learner flow
- the parent can switch learners quickly on phone and desktop
- per-learner state stays isolated and trustworthy
- the billing model can describe the household clearly

## Explicit Deferrals

This phase does not need to solve:

- fully merged cross-learner scheduling
- advanced co-op or classroom admin
- real-time multi-user collaboration
