# Path To Deployment

This folder is the working guide for getting `homeschool-v2` to a deployable state.

Use this `README.md` as the operational checklist.
Use the supporting docs in this folder for deeper planning and handoff detail.

## Supporting Docs

- [deployment-studio-roadmap.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/deployment-studio-roadmap.md)
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

- [ ] Implement Supabase SSR auth for the App Router.
- [ ] Add sign-in, sign-up, sign-out, and confirm flows.
- [ ] Resolve the adult user from authenticated Supabase identity.
- [ ] Resolve org membership from the database.
- [ ] Convert learner selection into workspace state instead of identity.
- [ ] Protect parent and learner routes with real auth checks.
- [ ] Review and reduce service-role usage.

### Phase 3: Authorization And Data Safety

- [ ] Inventory org-scoped and learner-scoped tables.
- [ ] Add RLS policies for user-facing tables.
- [ ] Add storage policies for uploads and evidence assets.
- [ ] Verify tenancy rules are enforced outside app code.
- [ ] Document the authorization model.

### Phase 4: Hosted Deployment Setup

- [ ] Create hosted Supabase staging and production projects.
- [ ] Create the Vercel project and environment setup.
- [ ] Define the full env var matrix for preview, staging, and production.
- [ ] Document the migration flow from local to hosted environments.
- [ ] Define backup and rollback expectations.
- [ ] Add monitoring and log access paths.

### Phase 5: Parent Product Redesign

- [ ] Redesign the shell into a thin, calm, premium product chrome.
- [ ] Remove duplicated navigation layers.
- [ ] Decide final placement for learner switching and studio access.
- [ ] Redesign `Today` as the primary operational surface.
- [ ] Keep debug panels accessible without polluting the product UI.

### Phase 6: Learner Flow Redesign

- [ ] Redesign learner activity pages around a reading surface.
- [ ] Improve mobile and tablet ergonomics for learner interactions.
- [ ] Move remaining learner runtime diagnostics into studio mode.
- [ ] Verify learner activity works well on phone and tablet widths.

### Phase 7: Remaining Product Surfaces

- [ ] Refresh copilot.
- [ ] Refresh curriculum.
- [ ] Refresh planning.
- [ ] Refresh tracking.
- [ ] Ensure all major surfaces follow the same product/studio split.

### Phase 8: Final Launch Prep

- [ ] Stand up a working staging environment.
- [ ] Run a responsive QA pass.
- [ ] Run a product-mode QA pass.
- [ ] Run a studio-mode QA pass.
- [ ] Verify auth, data safety, and hosted environment configuration.
- [ ] Prepare the production cutover checklist.

## Current Recommendation

Work this in order:

1. Studio mode foundation
2. Auth and workspace hardening
3. Authorization and RLS
4. Hosted setup
5. UX redesign
6. Final staging and launch prep

## How To Use This Folder

- Update this checklist as work starts and finishes.
- Keep deeper decisions in the supporting docs.
- When handing work to another agent, point them at this folder first.
- Treat this folder as the source of truth for the path to deployment.
