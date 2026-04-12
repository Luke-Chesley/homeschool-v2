# Phase 8: Final Launch Prep

Phase 8 is the last serious pre-launch pass for `homeschool-v2`.

The product and platform work from Phases 1 through 7 is already in place:
- studio mode exists and is separated from product mode
- hosted auth and authorization are in place
- staging and production Supabase projects exist
- Vercel staging and production deploy paths exist
- parent and learner product surfaces have been redesigned

So Phase 8 should not behave like another feature phase.

This phase is about proving the current product is launchable, documenting the remaining risks, and making production cutover boring.

## Outcome

At the end of Phase 8:
- the app has a clear launch scope
- staging has been reviewed end to end
- the remaining Phase 6 signoff gap is closed
- product mode and studio mode have both been verified on hosted environments
- auth, RLS, storage, and hosted env configuration have been rechecked in context
- production cutover and rollback steps are documented
- the team has one clear launch-day checklist instead of a loose pile of notes

## What Phase 8 Must Answer

Phase 8 should produce confident answers to these questions:

- What exactly is included in v1 launch?
- What remains intentionally deferred?
- Which hosted environment is the source of truth for final QA?
- Can a new household sign up and reach a workable day without operator intervention?
- Can a parent plan, open learner work, and use the main AI-assisted flows on staging?
- Can a learner complete the intended session flow on staging?
- If something breaks after deploy, what are the first recovery actions?

## Scope

### 1. Launch Scope Lock

Before deeper QA, lock the actual release scope:

- list launch-critical routes and flows
- list non-blocking known issues
- list intentionally deferred items
- confirm what is not shipping in v1

At minimum, that list should include:
- billing and Stripe deferred to Phase 9
- any remaining Phase 6 queue-state coverage gaps if they are not launch blockers
- any non-critical studio-mode heaviness that does not leak into product mode

### 2. Final Learner Signoff Closure

Phase 6 is functionally complete, but one signoff item remains:

- verify at least one fully completed learner session state end to end

That check should confirm:
- the activity can be completed without recovery ambiguity
- the end state feels finished and readable
- the learner can return to the queue cleanly
- completion does not reintroduce odd shell, scroll, or diagnostics issues

### 3. Hosted Staging QA

Run the real app on the staged hosted environment and verify:

- signed-out landing
- sign-up and sign-in
- onboarding/setup
- parent `Today`
- learner handoff from `Today`
- learner queue
- one real learner activity
- `Planning`
- `Curriculum`
- `Tracking`
- `Copilot`
- `Account`

The point is not to exhaustively test every pixel. It is to confirm the product works like one coherent app in the hosted environment the user will actually ship from.

If the staged hosted environment is blocked by preview protection for the reviewing session:
- run the same launch-critical pass locally first
- record that hosted rerun is still pending
- do not silently mark the hosted pass complete

### 4. Product Mode Vs Studio Mode QA

Repeat the key checks twice:

- product mode
- studio mode

Product mode must remain clean.

Studio mode must:
- expose the intended diagnostics
- stay secondary
- not structurally break the route

### 5. Hosted Configuration Review

Phase 8 must recheck the operational basics in their deployed shape:

- Vercel environment split
- Supabase staging/production split
- `learning-core` service reachability
- auth redirects
- session resolution
- RLS behavior assumptions
- storage bucket behavior for actual product flows

This is not the same as Phase 3 or Phase 4 implementation work. It is a launch-readiness confirmation pass.

### 6. Cutover And Rollback

Document:
- how production deploys happen
- how to confirm deploy health immediately after release
- how to roll back the app
- how to inspect Vercel logs
- how to inspect Cloud Run logs
- how to inspect Supabase auth/data/storage issues
- who owns the first-response checklist

## Out Of Scope

Do not turn Phase 8 into:

- another large product redesign
- billing implementation
- Stripe implementation
- new feature development unless the issue is a launch blocker
- native mobile app work
- broad refactors unrelated to launch safety

If a problem discovered in Phase 8 is not launch-critical, document it and defer it cleanly.

## Recommended Supporting Inputs

Read these first:

- [README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md)
- [phase6_learner_flow_checklist.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase6_learner_flow_checklist.md)
- [phase7_product_polish_checklist.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_product_polish_checklist.md)
- [phase4_hosted_deployment_setup.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_hosted_deployment_setup.md)
- [phase4_env_matrix.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_env_matrix.md)
- [phase4_provisioned_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase4_provisioned_inventory.md)
- [docs/qa/README.md](/home/luke/Desktop/homeschool-v2/docs/qa/README.md)
- [docs/qa/learner-flow-responsive-qa.md](/home/luke/Desktop/homeschool-v2/docs/qa/learner-flow-responsive-qa.md)
- [docs/qa/phase7-product-polish-qa.md](/home/luke/Desktop/homeschool-v2/docs/qa/phase7-product-polish-qa.md)

## Suggested Implementation Order

1. lock launch scope and explicit deferrals
2. close the remaining learner completion-state signoff
3. run hosted staging QA for core parent + learner + AI flows
4. run product-mode and studio-mode comparisons
5. verify storage and hosted environment assumptions
6. document cutover, rollback, logs, and owners
7. prepare the launch-day checklist

## Exit Criteria

Phase 8 is complete when:

- launch scope is explicit
- the remaining Phase 6 signoff item is closed
- staging QA for launch-critical flows is complete
- product mode and studio mode are both verified
- no launch-critical hosted configuration gaps remain undocumented
- a real production cutover and rollback checklist exists
