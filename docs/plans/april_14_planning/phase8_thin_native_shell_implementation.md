# Phase 8 Implementation

## Goal

Ship native-style distribution around the corrected launch flow without creating a second product or a forked backend contract.

## Current Fit With Repo

- Phase 7 already made the web runtime feel good on phone for sign in, onboarding, Today, learner switching, and activity open.
- The app still lacks a canonical shell entry route. A wrapper or installed app would have to guess whether to open `/today`, `/onboarding`, `/users`, or a learner activity path.
- The app also lacks install/standalone metadata and safe-area-aware shell behavior, so a thin wrapper would inherit browser chrome assumptions.
- `learning-core` already exposes `/healthz` and named operations, but it does not expose a small runtime-status payload that a shell/bootstrap surface can consume directly.

## Implementation Decision

Phase 8 will keep one web app and one `learning-core` service. It will not create a React Native or separate native product.

- add installable shell metadata to the existing Next app
- make the existing shell behave correctly in standalone/native-wrapper contexts
- add one canonical app entry route that resolves auth, onboarding, learner selection, and direct activity open
- add one bootstrap/status API in the app for shell consumers
- add one runtime-status endpoint in `learning-core` so the app can expose shared backend readiness cleanly

This keeps the thin shell honest: distribution and device affordances change, but product logic stays in the same places.

## Scope

### homeschool-v2

- add manifest, app icons, and standalone-capable root metadata
- add safe-area-aware shell styling and hide the browser-style global tabs in standalone mode
- add a canonical `/open` route that:
  - preserves auth/setup resume
  - resolves onboarding vs Today vs learner selection
  - can switch the active learner before redirecting
  - can open a learner activity session directly
- add `/api/mobile/bootstrap` so a wrapper can fetch one normalized payload for app/session/shell state
- add a small `learning-core` status client and expose that status through the bootstrap response

### learning-core

- add a lightweight runtime-status endpoint under `/v1/runtime/status`
- expose the service version and registered operation names without changing execution semantics

## Thin Shell Contract

### App entry

The shell should open exactly one canonical path: `/open`.

Supported launch intents:

- default open -> resolve to `/auth/login`, `/auth/setup`, `/onboarding`, `/users`, or `/today`
- `target=today`
- `target=learner`
- `target=users`
- `target=account`
- `target=activity&sessionId=...`
- optional `learnerId=...` to switch the active learner before redirect

### Standalone behavior

- the installed app or native wrapper should not show the browser-oriented global tabs
- safe-area insets should be respected for top bars and page bottoms
- the same `/today`, `/onboarding`, and learner activity routes should render inside the shell without alternate copies

### Bootstrap payload

`/api/mobile/bootstrap` should return one shared payload that answers:

- who is signed in
- whether workspace setup is required
- whether onboarding is complete
- which learner is active
- what route the shell should open by default
- whether `learning-core` is reachable and which operations are available

### Shared-backend rule

- the shell does not call different lesson/activity logic
- the shell does not fork onboarding logic
- the shell does not introduce separate learner state
- `learning-core` operations remain the same operations the web app already uses

## Workstreams

### 1. Install and standalone metadata

- `app/manifest.ts`
- generated app icons
- root metadata/viewport updates for standalone and safe-area support

### 2. Standalone shell behavior

- safe-area CSS tokens
- standalone-mode chrome adjustments
- no browser-style global tabs inside the installed shell

### 3. Canonical `/open` entry route

- shared intent parsing
- auth/setup resume preservation
- learner cookie switching when `learnerId` or `sessionId` imply a different learner
- direct redirect into Today or learner activity

### 4. Shell bootstrap/status endpoints

- `GET /api/mobile/bootstrap`
- `GET /v1/runtime/status`
- app-side status fetcher for `learning-core`

## Exit Criteria

- the app exposes install/standalone metadata without forking the product
- a shell can open `/open` and land in the correct shared route for auth, onboarding, Today, learner queue, or activity
- direct activity open can switch to the correct learner when that learner belongs to the current organization
- the app exposes one bootstrap payload that includes `learning-core` runtime status
- `learning-core` exposes lightweight runtime status without altering the operation contract
