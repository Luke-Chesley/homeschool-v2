# Learner Flow Responsive QA

Use this handoff when another agent needs to validate the learner experience end to end in a real browser.

This is an execution checklist for live browser QA, not a review of this document and not a code review.

The goal is to:
- run the app
- sign in
- click through the actual flows
- test laptop, tablet, and phone widths
- test product mode and studio mode on learner routes
- document the exact steps executed during the run
- report back on functional issues, layout problems, and weak UX states

Do not stop after reading files or inspecting routes. This task is only complete after the flows have been exercised in a browser.

## Scope

Primary review areas:
- parent `Today` to learner handoff
- learner queue at `/learner`
- learner activity runtime at `/activity/[sessionId]`
- product mode vs studio mode on learner routes
- responsive behavior at laptop, tablet, and phone widths

Secondary review areas:
- enough parent setup flow to create curriculum, planning, and learner activity states if the review account is too empty
- auth and onboarding only as needed to reach real learner work

## Environment

Repo:
- `/home/luke/Desktop/homeschool-v2`

Default review target:
- `http://localhost:3000`

If `localhost:3000` is not already running, start it from the main checkout:

```bash
corepack pnpm dev
```

## Review Account

Use the current local review account provided by the requesting agent or user.

If the provided credentials fail:
- create or use a valid local review account
- continue the QA run
- record exactly which account was used in the report

## Required Viewports

Test each of the core routes at:

- laptop: `1440x900`
- tablet: `1024x768` or `820x1180`
- phone: `390x844` or `393x852`

Do not limit the review to desktop. Use browser automation or responsive viewport testing and explicitly test laptop, tablet, and phone widths.

## Required Routes And Flows

### 1. Auth Entry

1. Open `/`.
2. Confirm the landing page loads.
3. Open `/auth/login`.
4. Sign in with the review account.

### 2. Parent Today Review

1. Open `/today`.
2. Review the default current-date state.
3. Review a date that has real learner work.
4. If `/today?date=2026-04-13` contains real learner work, use it.
5. If it does not, find or create a date with real learner work and use that instead.
6. Confirm whether learner work is clearly surfaced from `Today`.
7. Confirm whether the handoff into learner work feels obvious and direct.

### 3. Learner Queue Review

1. Open `/learner`.
2. Review:
   - empty state if present
   - in-progress grouping if present
   - up-next grouping if present
   - completed grouping if present
3. Confirm whether the next learner action is obvious.

### 4. Learner Activity Review

1. Open a real activity from the learner queue if available.
2. On `/activity/[sessionId]`, review:
   - top chrome
   - readability of instructions
   - touch target size
   - spacing and scroll behavior
   - submission flow
   - completion state
   - recovery state after an error or invalid attempt if one occurs
3. Confirm whether studio diagnostics stay secondary and do not dominate product mode.

### 5. Studio Mode Check

On learner routes, explicitly test both:

1. studio mode off
2. studio mode on

Required routes for this comparison:
- `/learner`
- one `/activity/[sessionId]`

Review:
- whether product mode stays clean
- whether studio controls are easy to reach
- whether studio diagnostics remain secondary
- whether enabling studio mode creates layout or usability regressions

### 6. Parent Setup If Data Is Too Thin

If the review account does not contain enough meaningful activity data, do enough parent setup to create it:

1. complete onboarding if needed
2. create or import a curriculum source
3. create a usable planning state
4. confirm at least one learner activity exists
5. return to `Today` and verify that the learner work is now reachable there

### 7. Responsive Coverage

At laptop, tablet, and phone widths, review:

- `/today`
- `/learner`
- one `/activity/[sessionId]` route if available

Specifically check for:
- duplicated headers or navigation bars
- actions hidden below the fold unnecessarily
- awkward wrapping
- overlong copy blocks
- hard-to-tap buttons or links
- submit controls that are hard to find
- studio controls crowding product content
- learner work that feels disconnected from `Today`

## What To Watch For

Prioritize these findings first:

- runtime errors
- console errors
- hydration issues
- broken auth redirects
- broken learner activity links
- duplicate keys or render warnings
- controls that disappear or become unusable at smaller widths

Collect browser console/runtime errors during the run.

Do not rely only on visual inspection. Explicitly capture:
- console errors
- runtime exceptions
- hydration warnings
- duplicate key warnings
- failed network requests if they block the flow

Then report UX problems that weaken the flow:

- learner activities are still too hidden from `Today`
- queue hierarchy is unclear
- activity instructions feel crowded or too sparse
- progress and completion states are hard to understand
- mobile spacing feels cramped or wasteful
- product mode feels noisy because studio affordances are too prominent

## Report Format

Return findings in this order:

1. Findings
   - ordered by severity
   - include route and reproduction steps
2. Responsive QA results
   - laptop
   - tablet
   - phone
3. Execution log
   - record the exact steps taken in order
   - include route, viewport, auth/setup actions, studio-mode toggles, and any data-creation/setup work performed
   - note any steps that were attempted but blocked
4. Flow coverage completed
   - what routes and flows were actually tested
5. Open questions or residual risks
6. Signoff recommendation
   - say explicitly whether the learner flow looks ready for signoff except for any remaining staging-only checks

## Notes

- This is not a redesign prompt.
- This is not a review of the QA document itself.
- Do not merge branches.
- Do not change code unless the assignment explicitly asks for fixes after the review.
