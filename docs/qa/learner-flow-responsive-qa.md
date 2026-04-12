# Learner Flow Responsive QA

Use this handoff when another agent needs to validate the learner experience end to end in a real browser.

This is responsive web QA, not code review. The goal is to click through the actual flows at laptop, tablet, and phone widths and report back on functional issues, layout problems, and weak UX states.

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

Use this local review account unless a newer one is provided:

- email: `phase6_review@example.com`
- password: `123456`

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
3. Open `/today?date=2026-04-13`.
4. Confirm whether learner work is clearly surfaced from `Today`.
5. Confirm whether the handoff into learner work feels obvious and direct.

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

### 5. Parent Setup If Data Is Too Thin

If the review account does not contain enough meaningful activity data, do enough parent setup to create it:

1. complete onboarding if needed
2. create or import a curriculum source
3. create a usable planning state
4. confirm at least one learner activity exists
5. return to `Today` and verify that the learner work is now reachable there

### 6. Responsive Coverage

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
3. Flow coverage completed
   - what routes and flows were actually tested
4. Open questions or residual risks
5. Signoff recommendation
   - say explicitly whether the learner flow looks ready for signoff except for any remaining staging-only checks

## Notes

- This is not a redesign prompt.
- Do not merge branches.
- Do not change code unless the assignment explicitly asks for fixes after the review.
