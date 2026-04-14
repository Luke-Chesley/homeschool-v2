# Phase 4: Mobile-First Parent Runtime

## Purpose

The parent should be able to use the core workflow from a phone.
That does not mean a native app rewrite is launch-critical.
It does mean phone-first product behavior is launch-critical.

This phase makes the parent runtime feel dependable on a phone for capture, Today, progress marking, and learner handoff.

## Outcome

At the end of Phase 4:

- onboarding fast path works on phone
- intake capture works on phone
- Today is fully usable on phone
- parents can mark progress and adjust the day on phone
- evidence capture feels phone-native enough to trust
- the product no longer assumes desktop for critical parent actions

## Product Rule

Ship responsive web as the launch surface.
Treat optional PWA polish as additive.
Defer native app packaging unless distribution, retention, or device capability clearly requires it later.

## Launch-Critical Phone Flows

### 1. Fast Signup To Today

A parent on a phone should be able to:

- sign up
- add a learner
- choose an intake route
- paste or upload source material
- generate Today
- land in Today without layout friction

### 2. Run The Day

A parent on a phone should be able to:

- open Today
- open a lesson draft
- generate or open an activity
- mark done / partial / skipped / moved
- switch learners

### 3. Capture Evidence

A parent on a phone should be able to:

- upload a photo of work
- attach a note
- connect it to the current item or session
- trust that the upload finished

### 4. Recover From Slow Generation

A parent on a phone should be able to:

- understand when background generation is running
- leave and return without losing the state
- retry failed generation cleanly

## UX Priorities

### Bigger Tap Targets, Smaller Cognitive Load

Phone design here is not about squeezing the desktop UI smaller.
It is about:

- fewer simultaneous controls
- sticky primary actions
- strong hierarchy around the current item
- inline status changes
- readable generation states

### Today Must Stay Calm

Do not turn the phone view into stacked card soup.
Keep the current item, lesson draft, and next action obvious.
Secondary context should collapse by default.

### Camera-Friendly Intake

The product should accept:

- photo upload for TOC / pages / work samples
- pasted text from mobile clipboard
- short typed notes

without pushing the user into desktop-only patterns.

## Recommended Technical Work

- audit all launch-critical parent flows on common phone widths
- harden loading, retry, and offline-adjacent recovery states
- ensure file uploads and progress actions work well over slower mobile connections
- add support for camera capture where the browser already provides it
- optionally add lightweight PWA installability and icon treatment after core UX is solid

## Suggested Implementation Order

1. fast-path onboarding on phone
2. Today phone ergonomics
3. progress actions and learner switching on phone
4. evidence upload on phone
5. generation recovery states on phone
6. optional PWA polish

## Exit Criteria

Phase 4 is complete when:

- a parent can activate from a phone without desktop fallback
- Today is fully usable on a phone for the core workflow
- evidence and intake uploads work cleanly on phone
- generation and retry states are readable and recoverable on phone
- the product feels phone-first even though it ships as responsive web

## Explicit Deferrals

This phase does not need to solve:

- app store distribution
- push notifications
- offline-first sync engine
- native camera or media pipelines beyond browser capability
