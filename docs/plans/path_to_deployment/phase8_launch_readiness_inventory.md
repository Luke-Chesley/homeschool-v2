# Phase 8: Launch Readiness Inventory

Use this file to keep the launch-prep pass concrete.

It should answer:
- what must work at launch
- what is already provisioned
- what still needs explicit verification
- what is intentionally deferred

## Launch-Critical Product Flows

These are the flows that should be treated as the v1 launch spine:

### Signed-Out Entry
- landing page
- sign-up
- sign-in

### Setup
- adult account setup
- household onboarding
- learner creation / selection

### Parent Product
- `Today`
- learner handoff from `Today`
- `Planning`
- `Curriculum`
- `Tracking`
- `Copilot`
- `Account`

### Learner Product
- `/learner`
- one real `/activity/[sessionId]`
- one real completed learner session state

## Provisioned Infrastructure

Already in place:

### Vercel
- production deploy path
- `stage` preview path
- environment variable split for preview vs production

### Supabase
- hosted staging project
- hosted production project
- auth wiring
- RLS and storage policy base

### Learning Core
- separate hosted service
- reachable from the web app

## Must-Recheck In Phase 8

### Auth
- sign-up
- sign-in
- sign-out
- onboarding handoff
- learner/workspace selection behavior

### Parent Flows
- `Today`
- `Planning`
- `Curriculum`
- `Tracking`
- `Copilot`
- `Account`

### Learner Flows
- queue
- activity launch
- activity completion
- post-completion return path

### Product / Studio Split
- parent product mode
- learner product mode
- parent studio mode
- learner studio mode

### Hosted Ops
- env separation
- storage flow
- runtime logs
- rollback readiness

## Known Deferrals

These should stay out of launch-critical scope unless the plan changes:

- Stripe and billing implementation
- real subscription management
- native mobile app work
- broad post-launch analytics or reporting expansion
- non-critical queue-state variants not present in the current QA account, if documented and accepted

## Current Phase 8 Reality

Local launch-prep QA has already confirmed:

1. launch-critical existing-account flows are stable locally
2. one fully completed learner session state is now verified locally
3. parent and learner product-mode/studio-mode comparisons are acceptable locally
4. cutover/rollback notes now exist as explicit docs

## Remaining Risks To Explicitly Resolve

The current remaining Phase 8 items are:

1. confirm hosted staging flows across the full parent + learner spine
2. verify a real hosted storage flow
3. manually validate fresh-account sign-up beyond flaky headless local automation
4. fill launch-day ownership and cutover responsibility details

## Launch Signoff Standard

`homeschool-v2` is launch-ready when:

- launch-critical flows work on staging
- the remaining learner completion-state signoff is closed
- no launch-critical hosted env gaps remain unknown
- production deployment and rollback steps are written down clearly
- deferred items are explicit rather than accidental





