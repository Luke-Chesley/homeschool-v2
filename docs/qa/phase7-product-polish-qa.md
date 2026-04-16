# Phase 7 Product Polish QA

Use this handoff to validate the Phase 7 product-polish pass in a live browser.

This is a browser QA run, not a review of this document and not a code review.

Focus on:
- `Account`
- `Tracking`
- auth and setup surfaces
- cross-surface consistency with the Phase 5 and 6 product language

## Environment

Repo:
- `/home/luke/Desktop/learning/homeschool-v2`

Review target:
- use the branch server URL provided by the implementing agent
- if none is provided, confirm whether this QA should run on `http://localhost:3000` or a branch port

## Required Viewports

Review at:
- laptop: `1440x900`
- tablet: `1024x768`
- phone: `390x844`

## Required Routes

Signed out:
- `/`
- `/auth/login`
- `/auth/sign-up`

Signed in:
- `/today`
- `/account`
- `/tracking`
- `/tracking/reports`

If accessible in the current account state:
- `/auth/setup`
- `/onboarding`
- `/users`

## Required Checks

### 1. Account

Review `/account` for:
- whether it feels like a real household-management surface
- whether current household context is clear
- whether billing is prepared for without reading like a placeholder
- whether at least one useful present-day action exists

### 2. Tracking

Review `/tracking` and `/tracking/reports` for:
- calmer copy
- readable hierarchy
- no dashboard filler
- practical evidence/progress/recommendation presentation
- consistency with the rest of the parent workspace

### 3. Auth And Setup

Review `/auth/login`, `/auth/sign-up`, and setup-related routes for:
- consistent spacing
- form readability
- clear labels and error states
- reduced copy
- visual consistency with the main app

### 4. Cross-Surface Consistency

Compare:
- `/today`
- `/curriculum`
- `/planning`
- `/copilot`
- `/tracking`
- `/account`

Look for:
- older header patterns
- extra explanatory copy
- inconsistent spacing
- inconsistent panel density
- surfaces that still feel transitional or prototype-like

## Console And Runtime Review

Capture:
- runtime errors
- console errors
- hydration warnings
- failed requests that block use

## Report Format

Return:
1. Findings ordered by severity
2. Execution log
3. Route and viewport coverage completed
4. Cross-surface consistency notes
5. Open questions or residual risks
6. Signoff recommendation for Phase 7

## Notes

- Do not merge anything.
- Do not review this document itself.
- Do not stop after reading code. Execute the flows in a browser.
