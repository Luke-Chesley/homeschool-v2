# Phase 4: Hosted Deployment Setup Checklist

Use this alongside [phase4_hosted_deployment_setup.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_hosted_deployment_setup.md) and [phase4_env_matrix.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_env_matrix.md).

This is the execution tracker for the hosted deployment setup pass.

## Status

- [x] Phase 4 started
- [ ] Phase 4 verified in staging
- [ ] Phase 4 merged to `main`

## Slice 1: Final Hosting Decisions

- [x] Confirm Vercel is the app host.
- [x] Confirm Cloud Run is the first hosted target for `learning-core`.
- [ ] Confirm whether staging uses a Vercel custom environment or a stable staging-branch preview.
- [ ] Confirm who owns production deploy permissions.
- [x] Record provider-plan assumptions before work starts.

## Slice 2: Hosted Supabase Projects

- [x] Create the hosted staging Supabase project.
- [x] Create the hosted production Supabase project.
- [ ] Record each project ref, project URL, Studio URL, publishable key, service role key, and database connection string.
- [x] Confirm auth and storage are enabled on both projects.
- [ ] Confirm backup capabilities on the selected hosted plan.

## Slice 3: Hosted `learning-core` Services

- [ ] Create the staging `learning-core` service.
- [ ] Create the production `learning-core` service.
- [ ] Record each service URL, health check path, build command, and start command.
- [ ] Add required environment variables and secrets.
- [ ] Confirm staging and production services are isolated from each other.

## Slice 4: Vercel Project Setup

- [x] Create or link the Vercel project.
- [ ] Confirm the production branch.
- [ ] Confirm preview deployment behavior.
- [ ] Add the app environment variables for preview, staging, and production.
- [ ] Record the resulting app URLs.

## Slice 5: Environment Matrix

- [x] Complete [phase4_env_matrix.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_env_matrix.md) with current hosted values and known owners/placeholders.
- [ ] Mark which env vars are public, secret, optional, or temporary.
- [ ] Mark which secrets must differ between staging and production.
- [ ] Confirm `NEXT_PUBLIC_SITE_URL` is correct for each hosted environment.
- [ ] Confirm `LEARNING_CORE_BASE_URL` points to the right environment-specific service.

## Slice 6: Migration Flow

- [x] Document the exact staging migration rollout path.
- [x] Document the exact production migration rollout path.
- [x] Remove hosted runtime dependence on `drizzle/` filesystem access.
- [ ] Verify the staged hosted database already reflects the current migration chain before app boot.
- [ ] Verify `public._hsv2_schema_migrations` reflects the latest applied SQL files in staging.
- [x] Record any migration risks that still depend on manual predeploy migration behavior.

## Slice 7: Staging Verification

- [ ] Staging app boots successfully.
- [ ] Staging auth works end to end.
- [ ] Staging app session resolution works.
- [ ] Staging storage access works.
- [ ] Staging `learning-core` connectivity works.
- [x] Phase 3 RLS verification assumptions still hold in hosted staging.
- [x] Supabase Security Advisor is checked against the staged hosted project.

## Slice 8: Monitoring, Backups, And Rollback

- [ ] Record where Vercel runtime logs are viewed.
- [x] Record where Supabase logs and backups are viewed.
- [x] Record where Cloud Run logs are intended to be viewed once provisioned.
- [ ] Document rollback for the app.
- [ ] Document rollback for `learning-core`.
- [ ] Document recovery path for Supabase staging and production.

## Docs And Tracking

- [x] Update [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) as Phase 4 starts and finishes.
- [x] Keep [phase4_hosted_deployment_setup.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_hosted_deployment_setup.md) current if implementation decisions change.
- [x] Keep [phase4_env_matrix.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_env_matrix.md) current with actual hosted values.
- [ ] Record any deferrals before moving into Phase 5.


## Current Blockers

- Hosted Supabase `SUPABASE_SERVICE_ROLE_KEY` and full `DATABASE_URL` values still need manual retrieval from the Supabase dashboard.
- Cloud Run provisioning for `learning-core` still needs GCP access and deployment tooling outside this session.
- Vercel env var entry for hosted secrets is still pending.
