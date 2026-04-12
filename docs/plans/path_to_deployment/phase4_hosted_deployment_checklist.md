# Phase 4: Hosted Deployment Setup Checklist

Use this alongside [phase4_hosted_deployment_setup.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_hosted_deployment_setup.md) and [phase4_env_matrix.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_env_matrix.md).

This is the execution tracker for the hosted deployment setup pass.

## Status

- [x] Phase 4 started
- [x] Phase 4 verified in staging
- [x] Phase 4 merged to `main`

## Slice 1: Final Hosting Decisions

- [x] Confirm Vercel is the app host.
- [x] Confirm Cloud Run is the first hosted target for `learning-core`.
- [x] Confirm whether staging uses a Vercel custom environment or a stable staging-branch preview.
- [ ] Confirm who owns production deploy permissions.
- [x] Record provider-plan assumptions before work starts.

## Slice 2: Hosted Supabase Projects

- [x] Create the hosted staging Supabase project.
- [x] Create the hosted production Supabase project.
- [x] Record each project ref, project URL, Studio URL, publishable key, service role key, and database connection string.
- [x] Confirm auth and storage are enabled on both projects.
- [ ] Confirm backup capabilities on the selected hosted plan.

## Slice 3: Hosted `learning-core` Services

- [x] Confirm a shared hosted `learning-core` deployment is acceptable for the current phase.
- [x] Record the shared `learning-core` env model for preview and production.
- [x] Add required environment variables and secrets.
- [ ] Split staging and production `learning-core` services later if operational isolation becomes necessary.

## Slice 4: Vercel Project Setup

- [x] Create or link the Vercel project.
- [x] Confirm the production branch.
- [x] Confirm preview deployment behavior.
- [x] Add the app environment variables for preview, staging, and production.
- [x] Record the resulting app URLs.

## Slice 5: Environment Matrix

- [x] Complete [phase4_env_matrix.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_env_matrix.md) with current hosted values and known owners/placeholders.
- [x] Mark which env vars are public, secret, optional, or temporary.
- [x] Mark which secrets must differ between staging and production.
- [x] Confirm `NEXT_PUBLIC_SITE_URL` is correct for each hosted environment.
- [x] Confirm `LEARNING_CORE_BASE_URL` points to the right environment-specific service.

## Slice 6: Migration Flow

- [x] Document the exact staging migration rollout path.
- [x] Document the exact production migration rollout path.
- [x] Remove hosted runtime dependence on `drizzle/` filesystem access.
- [x] Verify the staged hosted database already reflects the current migration chain before app boot.
- [x] Verify `public._hsv2_schema_migrations` reflects the latest applied SQL files in staging.
- [x] Record any migration risks that still depend on manual predeploy migration behavior.

## Slice 7: Staging Verification

- [x] Staging app boots successfully.
- [x] Staging auth works end to end.
- [x] Staging app session resolution works.
- [ ] Staging storage access works.
- [x] Staging `learning-core` connectivity works.
- [x] Phase 3 RLS verification assumptions still hold in hosted staging.
- [x] Supabase Security Advisor is checked against the staged hosted project.

## Slice 8: Monitoring, Backups, And Rollback

- [x] Record where Vercel runtime logs are viewed.
- [x] Record where Supabase logs and backups are viewed.
- [x] Record where Cloud Run logs are intended to be viewed once provisioned.
- [ ] Document rollback for the app.
- [ ] Document rollback for `learning-core`.
- [ ] Document recovery path for Supabase staging and production.

## Docs And Tracking

- [x] Update [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) as Phase 4 starts and finishes.
- [x] Keep [phase4_hosted_deployment_setup.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_hosted_deployment_setup.md) current if implementation decisions change.
- [x] Keep [phase4_env_matrix.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_env_matrix.md) current with actual hosted values.
- [x] Record any deferrals before moving into Phase 5.


## Current Deferrals

- Hosted storage still needs one explicit end-to-end verification pass before launch.
- App rollback, `learning-core` rollback, and Supabase recovery runbooks should be finalized during launch prep.
- A split staging/production `learning-core` deployment can wait until operational isolation becomes necessary.
