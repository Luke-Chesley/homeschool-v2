# Phase 3: Authorization And Data Safety Checklist

Use this alongside [phase3_authorization_data_safety.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/phase3_authorization_data_safety.md).

This is the execution tracker for the Phase 3 implementation pass.

## Status

- [x] Phase 3 started
- [ ] Phase 3 merged to `main`
- [x] Phase 3 verified locally

## Slice 1: Inventory And Policy Anchors

- [x] Confirm the full list of `public` tables relevant to tenancy.
- [x] Classify each table as org-scoped, learner-scoped, shared reference, or server-only.
- [x] Identify the policy anchor for each table.
- [x] Identify all storage buckets and path conventions in current use.
- [x] Record any tables that can remain outside end-user Data API access.

## Slice 2: Shared Authorization Helpers

- [x] Add SQL helper functions for current auth user lookup.
- [x] Add SQL helper functions for current adult-user lookup.
- [x] Add SQL helper functions for org membership checks.
- [x] Add SQL helper functions for learner access checks.
- [x] Decide whether any helper must be `security definer`.
- [x] Document the helper function contract.

## Slice 3: Core Identity And Learner Policies

- [x] Enable RLS on `adult_users`.
- [x] Enable RLS on `organizations`.
- [x] Enable RLS on `memberships`.
- [x] Enable RLS on `organization_platform_settings`.
- [x] Enable RLS on `learners`.
- [x] Enable RLS on `learner_profiles`.
- [x] Enable RLS on `learning_goals`.
- [x] Enable RLS on `goal_mappings`.
- [x] Add org and learner policies for this family.

## Slice 4: Curriculum, Routing, And Planning Policies

- [x] Enable RLS on curriculum source and item tables.
- [x] Enable RLS on curriculum routing tables.
- [x] Enable RLS on planning tables.
- [x] Add family-level select/insert/update/delete policies.
- [x] Verify plan and curriculum access fail across org boundaries.

## Slice 5: Activities, Workflow, Tracking, And Evidence Policies

- [x] Enable RLS on generated artifacts and activities.
- [x] Enable RLS on attempt and activity evidence tables.
- [x] Enable RLS on evidence, feedback, review, and tracking tables.
- [x] Add learner-sensitive policies for the full workflow family.
- [x] Verify high-sensitivity learner data cannot cross org boundaries.

## Slice 6: Copilot, Recommendations, Homeschool, And Standards Policies

- [x] Enable RLS on conversation, insight, and recommendation tables.
- [x] Enable RLS on homeschool attendance and audit tables.
- [x] Enable RLS on standards tables.
- [x] Separate global standards access from org-owned custom standards.
- [x] Resolve current Security Advisor warnings on `recommendations` and similar tables.

## Slice 7: Table Grants And Exposed Surface Review

- [x] Review `anon` grants on public user-facing tables.
- [x] Review `authenticated` grants on public user-facing tables.
- [x] Review and revoke broad grants where they are unnecessary for `anon`.
- [x] Record any intentionally public read surfaces.
- [x] Decide whether exposed schemas need later tightening beyond RLS.

## Slice 8: Storage Policies

- [x] Confirm bucket inventory and intended ownership model.
- [x] Add `storage.objects` select policies.
- [x] Add `storage.objects` insert policies.
- [x] Add `storage.objects` update/delete policies where needed.
- [x] Verify curriculum assets follow approved bucket/path rules.
- [x] Verify evidence uploads follow approved bucket/path rules.

## Slice 9: Verification

- [x] Signed-in user can only access their own organization rows.
- [x] Signed-in user cannot access another org through direct Data API calls.
- [x] Learner-scoped rows reject access when learner ownership does not match.
- [x] Storage rejects unauthorized reads and writes.
- [x] Service-role usage remains limited to documented server-only paths.
- [x] Supabase Security Advisor warnings are materially reduced or cleared.
- [x] Local app flows still work after policy enforcement.
- [x] `corepack pnpm typecheck` passes.

## Docs And Tracking

- [x] Keep [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/README.md) updated as work starts and finishes.
- [x] Keep [phase3_authorization_data_safety.md](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/phase3_authorization_data_safety.md) current if implementation decisions change.
- [x] Add a policy inventory/review note once the final migration set is known.
- [x] Record any deferrals before moving to Phase 4.

## Phase 3 Deferrals

- Re-run Supabase Security Advisor against the hosted staging project in Phase 4, since local verification does not guarantee the hosted advisor surface is fully clear.
- Consider narrowing exposed schemas beyond `public` in a later hardening pass; Phase 3 keeps the current exposed-schema model and relies on grants plus RLS.
