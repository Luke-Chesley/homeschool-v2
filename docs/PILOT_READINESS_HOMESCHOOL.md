# Homeschool Pilot Readiness

## In Scope For This Wedge

- homeschool onboarding
- curriculum intake through manual shell, pasted outline, or AI decomposition
- weekly planning
- daily workspace execution
- attendance, progress, and export-friendly reporting
- lightweight preferences and adaptation signals
- basic audit and observability hooks

## Explicitly Out Of Scope

- auth/login/session redesign
- audio recording
- transcription
- session summarization from microphone input

## Environment Notes

- The app still relies on the existing access path and learner-selection cookies.
- Async AI generation already exists for lesson drafts, worksheets, and adaptation jobs.
- Curriculum AI decomposition in onboarding and curriculum intake still runs in-request today; if pilot load grows, move that path onto the existing AI job queue next.
- Attendance and homeschool audit records require the `0007_homeschool_wedge_records.sql` migration.

## Basic Hardening Hooks Added

- `lib/platform/observability.ts` for product and error events
- homeschool audit ledger for onboarding, attendance, curriculum creation, and report exports
- report export endpoints for progress, attendance, and transcript skeletons

## Remaining Gaps Before A Wider Pilot

- move curriculum decomposition onto the async job path
- add retention cleanup for superseded/generated artifacts
- connect observability hooks to a real analytics/error backend
- add UI smoke coverage for onboarding and attendance flows
