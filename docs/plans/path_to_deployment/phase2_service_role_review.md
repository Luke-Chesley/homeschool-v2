# Phase 2: Service-Role Review

This review captures the remaining `service_role` usage after the Phase 2 auth and workspace hardening pass.

## Summary

Phase 2 moved end-user identity and workspace resolution onto Supabase SSR auth plus database-backed memberships.

That means `service_role` is no longer part of request authentication or workspace selection.
It remains available only for trusted backend operations that may still need elevated Supabase access.

## Current Usage

| Location | Current Use | Still Required In Phase 2 | Notes |
| --- | --- | --- | --- |
| `lib/auth/admin.ts` | Returns an admin Supabase client for trusted server-side auth admin operations. | Yes | Keep this server-only. It is not used for end-user session resolution anymore. |
| `lib/storage/client.ts` | Exposes an admin storage client for privileged storage operations. | Yes | Acceptable until Phase 3 storage policies are in place. User-scoped storage access should tighten after RLS/storage work. |
| `lib/platform/supabase.ts` | Central factory for the service-role client. | Yes | Required as the single construction point so elevated access stays easy to audit. |

## Removed From The Auth Path

The following Phase 2 paths now resolve without `service_role`:

- request auth session resolution
- authenticated adult-user lookup
- membership-backed organization resolution
- learner selection and workspace cookies
- sign-in, sign-up, confirm, and sign-out flows

## Risks That Remain

- Storage operations can still bypass eventual policy enforcement if they use the admin storage client.
- Any future route that reaches for `getAdminAuthClient()` without clear justification could widen backend trust again.
- There is still no database-level RLS enforcement in this phase. App code is stricter now, but Phase 3 still matters.

## Phase 3 Follow-Up

Before calling authorization complete, Phase 3 should:

1. add RLS for org-scoped and learner-scoped tables
2. add storage policies for uploads and evidence assets
3. review each caller of `getAdminStorageClient()` and downgrade to user-scoped access where possible
4. keep `service_role` confined to explicit backend-only maintenance or admin operations

## Decision

Phase 2 leaves `service_role` in place only for trusted server-only admin and storage helpers.
That is acceptable for this phase because auth identity and workspace access no longer depend on it.
