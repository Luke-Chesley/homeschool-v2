# Phase 2: Auth And Workspace Checklist

Use this alongside [phase2_auth_workspace_hardening.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase2_auth_workspace_hardening.md).

This is the execution tracker for the Phase 2 implementation pass.

## Status

- [x] Phase 2 started
- [ ] Phase 2 merged to `main`
- [x] Phase 2 verified locally

## Slice 1: SSR Auth Plumbing

- [x] Confirm the local Supabase auth flow we want to support first.
- [x] Add a request-safe server auth helper for App Router requests.
- [x] Resolve Supabase auth state from request cookies instead of only explicit access tokens.
- [x] Add a `requireAuthenticatedUser()` helper.
- [x] Document the SSR auth entry points for server components, route handlers, and server actions.

## Slice 2: Adult User And Membership Resolution

- [x] Add helper/repository support for resolving `adult_users` by `auth_user_id`.
- [x] Add helper/repository support for listing memberships for an adult user.
- [x] Add one canonical resolver for authorized organizations.
- [x] Decide fallback behavior when an authenticated user has no `adult_users` row.
- [x] Decide fallback behavior when an authenticated user has no memberships.

## Slice 3: App Session Refactor

- [x] Refactor `getAppSession()` to use authenticated identity first.
- [x] Keep organization cookie as workspace preference only.
- [x] Keep learner cookie as workspace preference only.
- [x] Ignore invalid org cookies and fall back to an authorized organization.
- [x] Ignore invalid learner cookies and fall back to a valid learner in the active organization.
- [x] Keep the existing `AppWorkspace` shape stable where practical.

## Slice 4: Auth Routes And Screens

- [x] Add sign-in route/page.
- [x] Add sign-up route/page.
- [x] Add auth callback or confirm route.
- [x] Add sign-out action/route.
- [x] Ensure signed-in flows land on a valid app route.
- [x] Keep the first pass minimal and functional, not a full design pass.

## Slice 5: Route Protection

- [x] Protect parent routes with authenticated adult-user checks.
- [x] Protect learner routes with authenticated adult-user checks.
- [x] Ensure learner routes still require a valid active learner.
- [x] Update root routing based on signed-in vs signed-out state.
- [x] Define the path for signed-in users with no membership.
- [x] Define the path for signed-in users with membership but no learner.

## Slice 6: Workspace Selection Cleanup

- [x] Review `/api/app-session` and align it to auth-backed session semantics.
- [x] Review `/api/users` and align it to auth-backed session semantics.
- [x] Update any client code that assumes cookie changes alone define identity.
- [x] Ensure org switching is revalidated against membership.
- [x] Ensure learner switching is revalidated against the active organization.

## Slice 7: Service-Role Review

- [x] Inventory current `service_role` usage.
- [x] Mark which uses are still required in Phase 2.
- [x] Mark which uses should move to user-scoped auth before Phase 3.
- [x] Write the service-role review summary into the deployment docs folder.

## Slice 8: Verification

- [x] Signed-out user cannot load parent routes.
- [x] Signed-out user cannot load learner routes.
- [x] Signed-in user only resolves organizations from valid membership.
- [x] Invalid org cookie falls back safely.
- [x] Invalid learner cookie falls back safely.
- [x] Sign-out removes app access.
- [x] Studio mode still works in local development after auth changes.
- [x] `corepack pnpm typecheck` passes.
- [x] Route-level browser checks pass for parent and learner flows.

## Docs And Tracking

- [x] Keep [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) updated as work starts and finishes.
- [x] Keep [phase2_auth_workspace_hardening.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase2_auth_workspace_hardening.md) current if implementation decisions change.
- [x] Record any scope cuts or deferrals before moving to Phase 3.

## Notes

- Local verification used the Supabase local stack plus real sign-up/sign-in flows.
- Merge remains open until the branch is reviewed and approved.
- Phase 3 should begin with RLS and storage policy work, not more auth UI changes.
