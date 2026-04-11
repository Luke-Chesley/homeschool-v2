# Phase 3: Authorization And Data Safety Checklist

Use this alongside [phase3_authorization_data_safety.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase3_authorization_data_safety.md).

This is the execution tracker for the Phase 3 implementation pass.

## Status

- [ ] Phase 3 started
- [ ] Phase 3 merged to `main`
- [ ] Phase 3 verified locally

## Slice 1: Inventory And Policy Anchors

- [ ] Confirm the full list of `public` tables relevant to tenancy.
- [ ] Classify each table as org-scoped, learner-scoped, shared reference, or server-only.
- [ ] Identify the policy anchor for each table.
- [ ] Identify all storage buckets and path conventions in current use.
- [ ] Record any tables that can remain outside end-user Data API access.

## Slice 2: Shared Authorization Helpers

- [ ] Add SQL helper functions for current auth user lookup.
- [ ] Add SQL helper functions for current adult-user lookup.
- [ ] Add SQL helper functions for org membership checks.
- [ ] Add SQL helper functions for learner access checks.
- [ ] Decide whether any helper must be `security definer`.
- [ ] Document the helper function contract.

## Slice 3: Core Identity And Learner Policies

- [ ] Enable RLS on `adult_users`.
- [ ] Enable RLS on `organizations`.
- [ ] Enable RLS on `memberships`.
- [ ] Enable RLS on `organization_platform_settings`.
- [ ] Enable RLS on `learners`.
- [ ] Enable RLS on `learner_profiles`.
- [ ] Enable RLS on `learning_goals`.
- [ ] Enable RLS on `goal_mappings`.
- [ ] Add org and learner policies for this family.

## Slice 4: Curriculum, Routing, And Planning Policies

- [ ] Enable RLS on curriculum source and item tables.
- [ ] Enable RLS on curriculum routing tables.
- [ ] Enable RLS on planning tables.
- [ ] Add family-level select/insert/update/delete policies.
- [ ] Verify plan and curriculum access fail across org boundaries.

## Slice 5: Activities, Workflow, Tracking, And Evidence Policies

- [ ] Enable RLS on generated artifacts and activities.
- [ ] Enable RLS on attempt and activity evidence tables.
- [ ] Enable RLS on evidence, feedback, review, and tracking tables.
- [ ] Add learner-sensitive policies for the full workflow family.
- [ ] Verify high-sensitivity learner data cannot cross org boundaries.

## Slice 6: Copilot, Recommendations, Homeschool, And Standards Policies

- [ ] Enable RLS on conversation, insight, and recommendation tables.
- [ ] Enable RLS on homeschool attendance and audit tables.
- [ ] Enable RLS on standards tables.
- [ ] Separate global standards access from org-owned custom standards.
- [ ] Resolve current Security Advisor warnings on `recommendations` and similar tables.

## Slice 7: Table Grants And Exposed Surface Review

- [ ] Review `anon` grants on public user-facing tables.
- [ ] Review `authenticated` grants on public user-facing tables.
- [ ] Revoke broad grants where they are unnecessary.
- [ ] Record any intentionally public read surfaces.
- [ ] Decide whether exposed schemas need later tightening beyond RLS.

## Slice 8: Storage Policies

- [ ] Confirm bucket inventory and intended ownership model.
- [ ] Add `storage.objects` select policies.
- [ ] Add `storage.objects` insert policies.
- [ ] Add `storage.objects` update/delete policies where needed.
- [ ] Verify curriculum assets follow approved bucket/path rules.
- [ ] Verify evidence uploads follow approved bucket/path rules.

## Slice 9: Verification

- [ ] Signed-in user can only access their own organization rows.
- [ ] Signed-in user cannot access another org through direct Data API calls.
- [ ] Learner-scoped rows reject access when learner ownership does not match.
- [ ] Storage rejects unauthorized reads and writes.
- [ ] Service-role usage remains limited to documented server-only paths.
- [ ] Supabase Security Advisor warnings are materially reduced or cleared.
- [ ] Local app flows still work after policy enforcement.
- [ ] `corepack pnpm typecheck` passes.

## Docs And Tracking

- [ ] Keep [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) updated as work starts and finishes.
- [ ] Keep [phase3_authorization_data_safety.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase3_authorization_data_safety.md) current if implementation decisions change.
- [ ] Add a policy inventory/review note once the final migration set is known.
- [ ] Record any deferrals before moving to Phase 4.
