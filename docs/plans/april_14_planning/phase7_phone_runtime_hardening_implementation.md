# Phase 7 Implementation

## Goal

Make the corrected launch flow feel reliable on phone before any native wrapper work starts.

## Current Fit With Repo

- `components/onboarding/homeschool-onboarding-form.tsx` already supports text, photo, image, PDF, and file intake, but mobile upload states are still mostly implicit.
- `/today` already shows auto-build states for lesson and activity generation, but route-level loading and mobile action density still need work.
- `app/(learner)/activity/[sessionId]/page.tsx` loads the learner session client-side and currently falls back to a minimal text loading state.
- `components/auth/AuthCredentialsForm.tsx` and `components/auth/AuthSetupForm.tsx` do not preserve `next` all the way through sign in, sign up, setup, and onboarding resume, which is a real mobile re-entry risk.

## Implementation Decision

Phase 7 will harden the phone runtime inside the existing web app. It will not start native packaging yet.

- keep the current fast-path onboarding model
- make source upload and intake preparation status explicit on phone
- preserve auth/setup resume targets end-to-end
- add mobile-friendly loading shells for onboarding, Today, and learner activity
- increase tap-target size and reduce cramped action clusters on phone

This phase should make the browser flow feel native-ready without forking product logic.

## Scope

### homeschool-v2

- add a mobile-first onboarding upload state model with clear retry affordances
- keep `next` through login, sign-up, workspace setup, and onboarding resume
- add route-level loading shells for `/onboarding`, `/today`, and learner activity
- make Today and learner activity controls easier to use on narrow screens
- keep the first-day build state understandable after refresh or resume

### learning-core

- no required change in this phase
- the phone hardening work should consume the same intake, lesson, and activity operations already in place

## Mobile Runtime Contract

### Onboarding

- selecting a file or photo should immediately show what was chosen
- upload / prepare states should be visible instead of collapsing into one generic status line
- failed upload/package creation should leave the selected asset in place and expose a direct retry action
- primary step actions should remain easy to reach on phone

### Auth and resume

- a parent who starts from `/onboarding`, `/today`, or a learner activity deep link should return to that path after login/setup when appropriate
- sign-up should not silently discard the intended resume destination
- workspace setup should continue into onboarding or the originally requested route, not always a hardcoded default

### Today and learner activity

- route transitions into `/today` and learner activity should show a calm loading shell instead of a blank jump
- mobile action groups should favor stacked or wrapped controls with larger tap targets
- the parent should be able to keep today bounded or expand the route without tiny clustered controls

## Workstreams

### 1. Onboarding phone capture and retry

- file/photo card with selected asset summary
- explicit status stages for:
  - preparing source
  - uploading source
  - generating first day
- retry button that reuses the current source input or selected file

### 2. Auth resume continuity

- thread `next` through:
  - `/auth/login`
  - `/auth/sign-up`
  - `/auth/setup`
- preserve the resume destination after successful account creation and workspace setup

### 3. Loading and boot shells

- `app/onboarding/loading.tsx`
- `app/(parent)/today/loading.tsx`
- `app/(learner)/activity/[sessionId]/loading.tsx`
- keep the visual language consistent with the warm, quiet planning UI

### 4. Thumb-friendly controls

- make onboarding step actions full-width or sticky on phone where needed
- enlarge Today lesson/activity action clusters on small screens
- make learner activity submission and recovery controls easier to hit on narrow viewports

## Exit Criteria

- onboarding file/photo intake has visible status and retry behavior on phone
- login/sign-up/setup preserve intended resume targets
- onboarding, Today, and learner activity show mobile-appropriate loading shells
- no small-screen choke points remain in the corrected AI intake launch flow
