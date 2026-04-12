# Phase 8: Launch Checklist

Use this alongside [phase8_final_launch_prep.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase8_final_launch_prep.md) and [phase8_launch_readiness_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase8_launch_readiness_inventory.md).

## Phase Status

- [x] Phase 8 planning started
- [x] Phase 8 implementation started
- [x] Launch scope locked
- [ ] Final staging QA completed
- [x] Local launch-readiness QA completed
- [x] Cutover and rollback docs completed

## Launch Scope Lock

- [x] Record the exact v1 launch-critical routes and flows.
- [x] Record intentionally deferred features and known non-blocking issues.
- [x] Confirm that Stripe remains deferred to Phase 9.
- [x] Confirm whether any remaining learner queue-state gaps are launch blockers or explicit deferrals.

## Final Learner Signoff

- [x] Verify one live learner session through a fully completed end state.
- [x] Confirm the learner sees a clear finished state and next path after completion.
- [x] Confirm return-to-queue behavior after completion.
- [x] Record whether empty, up-next, and completed queue groupings were live-verified or explicitly deferred.

## Hosted Staging QA

- [ ] Verify the signed-out landing page on staging.
- [ ] Verify sign-up on staging.
- [ ] Verify sign-in on staging.
- [ ] Verify onboarding/setup on staging.
- [ ] Verify parent `Today` on staging.
- [ ] Verify learner handoff from `Today` on staging.
- [ ] Verify `/learner` on staging.
- [ ] Verify one real `/activity/[sessionId]` route on staging.
- [ ] Verify `Planning` on staging.
- [ ] Verify `Curriculum` on staging.
- [ ] Verify `Tracking` on staging.
- [ ] Verify `Copilot` on staging.
- [ ] Verify `Account` on staging.
- [ ] Re-run these checks on hosted staging once Vercel protection is bypassed for the reviewing agent/session.

## Product Mode Vs Studio Mode

- [x] Verify key parent routes in product mode.
- [x] Verify key learner routes in product mode.
- [x] Verify key parent routes in studio mode.
- [x] Verify key learner routes in studio mode.
- [x] Confirm studio diagnostics remain secondary and do not pollute product mode.

## Hosted Configuration Checks

- [ ] Confirm staging Vercel env vars point at staging Supabase.
- [ ] Confirm production Vercel env vars point at production Supabase.
- [ ] Confirm `learning-core` is reachable from the deployed app.
- [ ] Confirm auth redirects and session resolution behave correctly on staging.
- [ ] Reconfirm storage behavior on a real hosted product flow.
- [ ] Reconfirm no new hosted runtime errors are showing in the critical flows.
- [ ] Record the hosted sign-up behavior explicitly once staging is reachable from this session.

## Monitoring And Recovery

- [x] Document where to inspect Vercel runtime logs.
- [x] Document where to inspect Cloud Run service logs.
- [x] Document where to inspect Supabase auth/data/storage issues.
- [x] Document the production rollback path for app deploys.
- [x] Document the first-response checklist for launch-day issues.

## Launch-Day Checklist

- [ ] Record the exact branch and deploy path for release.
- [ ] Record the immediate post-deploy smoke-test routes.
- [ ] Record the owner for deploy execution.
- [ ] Record the owner for QA verification.
- [ ] Record the owner for rollback if needed.

## Documentation

- [x] Update [README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) as Phase 8 starts and finishes.
- [x] Keep [phase8_final_launch_prep.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase8_final_launch_prep.md) current if scope changes.
- [x] Keep [phase8_launch_readiness_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase8_launch_readiness_inventory.md) current as environments and risks are rechecked.
