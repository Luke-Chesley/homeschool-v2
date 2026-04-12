# Path To Deployment

This folder is the working guide for getting `homeschool-v2` to a deployable state.

Use this `README.md` as the operational checklist.
Use the supporting docs in this folder for deeper planning and handoff detail.

## Supporting Docs

- [deployment-studio-roadmap.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/deployment-studio-roadmap.md)
- [phase2_auth_workspace_hardening.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase2_auth_workspace_hardening.md)
- [phase2_auth_workspace_checklist.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase2_auth_workspace_checklist.md)
- [phase2_service_role_review.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase2_service_role_review.md)
- [phase3_authorization_data_safety.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase3_authorization_data_safety.md)
- [phase3_authorization_data_checklist.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase3_authorization_data_checklist.md)
- [phase3_authorization_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase3_authorization_inventory.md)
- [phase4_hosted_deployment_setup.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_hosted_deployment_setup.md)
- [phase4_hosted_deployment_checklist.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_hosted_deployment_checklist.md)
- [phase4_env_matrix.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_env_matrix.md)
- [phase4_provisioned_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_provisioned_inventory.md)
- [phase5_parent_product_redesign.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase5_parent_product_redesign.md)
- [phase5_parent_product_checklist.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase5_parent_product_checklist.md)
- [phase5_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase5_surface_inventory.md)
- [phase5_checklist_design_review.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase5_checklist_design_review.md)
- [phase6_learner_flow_redesign.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_flow_redesign.md)
- [phase6_learner_flow_checklist.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_flow_checklist.md)
- [phase6_learner_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_surface_inventory.md)
- [phase7_product_polish_and_account_surfaces.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_product_polish_and_account_surfaces.md)
- [phase7_product_polish_checklist.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_product_polish_checklist.md)
- [phase7_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_surface_inventory.md)
- [phase8_final_launch_prep.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase8_final_launch_prep.md)
- [phase8_launch_checklist.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase8_launch_checklist.md)
- [phase8_launch_readiness_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase8_launch_readiness_inventory.md)
- [phase9_billing_and_stripe.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase9_billing_and_stripe.md)
- [studio-mode-implementation-checklist.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/studio-mode-implementation-checklist.md)
- [studio-mode-agent-handoff.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/studio-mode-agent-handoff.md)

## Deployment Progress Checklist

### Phase 0: Scope And Product Decisions

- [ ] Lock the v1 launch scope.
- [ ] Confirm the product stays as one web app, not a new repo.
- [ ] Confirm `learning-core` remains a separate deployed service.
- [ ] Confirm responsive web first, with no native mobile app in v1.
- [ ] Confirm debug visibility moves into `studio mode`, not product mode.
- [ ] Decide whether Inngest is required for v1 or can stay out of launch-critical paths.

### Phase 1: Studio Mode Foundation

- [x] Define the local-first studio access rules.
- [x] Add server-side studio access resolution.
- [x] Add studio client context for UI composition.
- [x] Build reusable studio UI primitives.
- [x] Add a quiet studio toggle in the existing shell.
- [x] Move lesson draft debug info out of the default reading flow.
- [x] Add shared trace metadata UI.
- [x] Extend the studio pattern to curriculum AI, copilot, and learner runtime diagnostics.
- [x] Document how studio mode works and how new studio panels should be added.
- [x] Verify the product/studio split locally.
- [x] Verify studio tooling is available on learner routes as well as parent routes.

### Phase 2: Auth And Workspace Hardening

- [x] Implement Supabase SSR auth for the App Router.
- [x] Add sign-in, sign-up, sign-out, and confirm flows.
- [x] Resolve the adult user from authenticated Supabase identity.
- [x] Resolve org membership from the database.
- [x] Convert learner selection into workspace state instead of identity.
- [x] Protect parent and learner routes with real auth checks.
- [x] Review and reduce service-role usage.
- [x] Verify the signed-out, signed-in, and workspace-fallback flows locally.
- [x] Merge Phase 2 to `main`.

### Phase 3: Authorization And Data Safety

- [x] Inventory org-scoped and learner-scoped tables.
- [x] Add RLS policies for user-facing tables.
- [x] Add storage policies for uploads and evidence assets.
- [x] Verify tenancy rules are enforced outside app code.
- [x] Document the authorization model.

### Phase 4: Hosted Deployment Setup

- [x] Create hosted Supabase staging and production projects.
- [x] Create the Vercel project and local project link.
- [x] Define the full env var matrix for preview, staging, and production.
- [x] Document the migration flow from local to hosted environments.
- [x] Remove hosted runtime dependence on local `drizzle/` files.
- [x] Define backup and rollback expectations.
- [x] Add monitoring and log access paths.
- [x] Verify the staging environment end to end for app boot, auth, and core AI flows.

### Phase 5: Parent Product Redesign

- [x] Redesign the shell into a thin, calm, premium product chrome.
- [x] Define the Phase 5 parent design system and reading-surface rules.
- [x] Apply the relevant checklist.design component and flow review to the redesign scope.
- [x] Remove duplicated navigation layers.
- [x] Decide final placement for learner switching and studio access.
- [x] Redesign `Today` as the primary operational surface.
- [x] Redesign `Planning`, `Curriculum`, `Tracking`, and `Copilot` into one coherent parent product language.
- [x] Keep debug panels accessible without polluting the product UI.

### Phase 6: Learner Flow Redesign

- [x] Redesign learner activity pages around a reading surface.
- [x] Redesign learner home around a calmer daily queue.
- [x] Simplify the learner shell so content starts quickly.
- [x] Improve mobile and tablet ergonomics for learner interactions.
- [x] Move remaining learner runtime diagnostics into studio mode.
- [x] Standardize learner loading, error, submit, and completion states.
- [x] Verify learner activity works well on phone and tablet widths.
- [ ] Verify one fully completed learner session state before final signoff.

### Phase 7: Product Polish And Account Surfaces

- [x] Turn `Account` into a real household-management surface.
- [x] Polish `Tracking` into the same calm product language as the rest of the parent app.
- [x] Refine auth and setup flows so they feel fully productized.
- [x] Standardize remaining cross-surface headers, empty states, disclosure patterns, and feedback states.
- [x] Run a final consistency pass across `Today`, `Planning`, `Curriculum`, `Tracking`, `Copilot`, and `Account`.

### Phase 8: Final Launch Prep

- [ ] Confirm the exact launch scope and deferred items list.
- [ ] Close the final Phase 6 learner signoff item.
- [ ] Run a full staging QA pass on current hosted preview/stage.
- [ ] Run a product-mode QA pass on staging.
- [ ] Run a studio-mode QA pass on staging.
- [ ] Verify auth, RLS, storage, and hosted environment configuration.
- [ ] Verify core parent, learner, and AI-assisted flows on staging.
- [ ] Document production cutover, rollback, and monitoring steps.
- [ ] Prepare the launch-day checklist and owner handoff.

### Phase 9: Billing And Stripe

- [ ] Define pricing and household plan rules.
- [ ] Choose the Stripe billing shape and customer-management model.
- [ ] Implement Stripe products, prices, and webhook handling.
- [ ] Connect `Account` to real billing state.
- [ ] Verify subscription and billing recovery flows.

## Current Recommendation

Work this in order:

1. Studio mode foundation
2. Auth and workspace hardening
3. Authorization and RLS
4. Hosted setup
5. UX redesign
6. Learner flow redesign
7. Product polish and account surfaces
8. Final staging and launch prep
9. Billing and Stripe

## Current State

- Phase 1 is complete on `main`.
- Phase 2 is complete on `main`.
- Phase 3 is complete on `main`.
- Phase 4 is complete with explicit deferrals. Supabase staging/production, the Vercel project, staged hosted verification, and the hosted boot fix are in place. Remaining storage verification and rollback runbooks move into launch prep.
- Phase 5 is complete on `main`, and `stage` has been realigned to the same commit.
- Phase 6 is implemented on `main` and `stage`. Responsive QA has passed, and the only remaining signoff item is one targeted completed-session verification.
- Phase 7 is complete on `main` and `stage`.
- Phase 8 is now the active phase: launch-prep QA, hosted verification, cutover, and rollback readiness.
- Stripe is intentionally deferred to Phase 9 so billing work does not get mixed into product-polish or launch-prep scope.

## How To Use This Folder

- Update this checklist as work starts and finishes.
- Keep deeper decisions in the supporting docs.
- When handing work to another agent, point them at this folder first.
- Treat this folder as the source of truth for the path to deployment.
