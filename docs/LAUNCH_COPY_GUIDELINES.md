# Launch Copy Guidelines

This document is the launch copy source of truth for `homeschool-v2`.

Use it before changing signed-out pages, onboarding, Curriculum, Today, Tracking, Copilot, Account, or Learners.

## Product framing

The product promise is:

- bring what you already have
- open a teachable day quickly
- keep a clear day and a sane week nearby
- keep records without extra bookkeeping

Parents should understand the input -> output story fast:

1. bring a chapter, outline, weekly plan, topic, photo, or PDF
2. open a clear day with a lesson and activity
3. keep progress, adjustments, and records in one place

## Approved language

Prefer:

- bring what you already have
- teachable day
- clear day
- sane week
- records
- learner
- household
- start from today
- keep the week nearby
- ask for the next move

## Avoid on parent-facing surfaces

Do not expose these on normal parent surfaces:

- `learning-core`
- provider or model routing details
- workspace ID
- graph workspace
- local sample
- sandbox
- Stripe env vars
- route board
- source interpret
- launchPlan
- graph workspace

Do not use placeholder language like:

- will live here later
- expand here over time
- not configured in this environment
- launch-safe
- local service issue

Keep diagnostics behind studio or development-only surfaces.

## Homepage promise

The homepage should foreground:

- what the parent brings
- what the app does immediately
- what they get next

Minimum homepage ingredients:

- explicit mention of paste, upload, or photo input
- clear input -> output story
- Today as the first value moment

## Onboarding promise

Onboarding should stay aligned with the homepage:

- add one learner
- bring what you already have
- reach Today quickly

Do not make the homepage sound broader or more abstract than onboarding.

## Parent-facing tone rules

- be calm, direct, and specific
- describe what the parent can do next
- prefer product language over system language
- keep copy short enough to scan on a phone
- name the practical result, not the backend mechanism

## Quick review checklist

Before shipping copy changes, ask:

1. Would a new parent understand the value in under 10 seconds?
2. Does this sound like the onboarding wedge?
3. Does any internal or dev language leak through?
4. Is the next action obvious?
5. Does the page feel like a product surface instead of scaffolding?
