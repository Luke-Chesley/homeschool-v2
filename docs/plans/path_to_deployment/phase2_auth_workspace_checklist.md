# Phase 2: Auth And Workspace Checklist

Use this alongside [phase2_auth_workspace_hardening.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase2_auth_workspace_hardening.md).

This is the execution tracker for the Phase 2 implementation pass.

## Status

- [ ] Phase 2 started
- [ ] Phase 2 merged to `main`
- [ ] Phase 2 verified locally

## Slice 1: SSR Auth Plumbing

- [ ] Confirm the local Supabase auth flow we want to support first.
- [ ] Add a request-safe server auth helper for App Router requests.
- [ ] Resolve Supabase auth state from request cookies instead of only explicit access tokens.
- [ ] Add a `requireAuthenticatedUser()` helper.
- [ ] Document the SSR auth entry points for server components, route handlers, and server actions.

## Slice 2: Adult User And Membership Resolution

- [ ] Add helper/repository support for resolving `adult_users` by `auth_user_id`.
- [ ] Add helper/repository support for listing memberships for an adult user.
- [ ] Add one canonical resolver for authorized organizations.
- [ ] Decide fallback behavior when an authenticated user has no `adult_users` row.
- [ ] Decide fallback behavior when an authenticated user has no memberships.

## Slice 3: App Session Refactor

- [ ] Refactor `getAppSession()` to use authenticated identity first.
- [ ] Keep organization cookie as workspace preference only.
- [ ] Keep learner cookie as workspace preference only.
- [ ] Ignore invalid org cookies and fall back to an authorized organization.
- [ ] Ignore invalid learner cookies and fall back to a valid learner in the active organization.
- [ ] Keep the existing `AppWorkspace` shape stable where practical.

## Slice 4: Auth Routes And Screens

- [ ] Add sign-in route/page.
- [ ] Add sign-up route/page.
- [ ] Add auth callback or confirm route.
- [ ] Add sign-out action/route.
- [ ] Ensure signed-in flows land on a valid app route.
- [ ] Keep the first pass minimal and functional, not a full design pass.

## Slice 5: Route Protection

- [ ] Protect parent routes with authenticated adult-user checks.
- [ ] Protect learner routes with authenticated adult-user checks.
- [ ] Ensure learner routes still require a valid active learner.
- [ ] Update root routing based on signed-in vs signed-out state.
- [ ] Define the path for signed-in users with no membership.
- [ ] Define the path for signed-in users with membership but no learner.

## Slice 6: Workspace Selection Cleanup

- [ ] Review `/api/app-session` and align it to auth-backed session semantics.
- [ ] Review `/api/users` and align it to auth-backed session semantics.
- [ ] Update any client code that assumes cookie changes alone define identity.
- [ ] Ensure org switching is revalidated against membership.
- [ ] Ensure learner switching is revalidated against the active organization.

## Slice 7: Service-Role Review

- [ ] Inventory current `service_role` usage.
- [ ] Mark which uses are still required in Phase 2.
- [ ] Mark which uses should move to user-scoped auth before Phase 3.
- [ ] Write the service-role review summary into the deployment docs folder.

## Slice 8: Verification

- [ ] Signed-out user cannot load parent routes.
- [ ] Signed-out user cannot load learner routes.
- [ ] Signed-in user only resolves organizations from valid membership.
- [ ] Invalid org cookie falls back safely.
- [ ] Invalid learner cookie falls back safely.
- [ ] Sign-out removes app access.
- [ ] Studio mode still works in local development after auth changes.
- [ ] `corepack pnpm typecheck` passes.
- [ ] Route-level browser checks pass for parent and learner flows.

## Docs And Tracking

- [ ] Keep [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) updated as work starts and finishes.
- [ ] Keep [phase2_auth_workspace_hardening.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase2_auth_workspace_hardening.md) current if implementation decisions change.
- [ ] Record any scope cuts or deferrals before moving to Phase 3.
