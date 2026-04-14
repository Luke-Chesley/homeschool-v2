# Path To Activation Launch

This folder is the working guide for getting `homeschool-v2` from "deployable" to "worth paying for."

Use this folder alongside `docs/plans/path_to_deployment/`.

`path_to_deployment` covers platform hardening, hosted setup, auth, RLS, product polish, and launch operations.
This folder covers the remaining launch-critical product work:

- faster time to first value
- lower-friction curriculum intake
- multi-learner household usability
- phone-first parent runtime
- pricing and billing shape
- beta metrics and go / no-go criteria

The goal is not to create a broader product.
The goal is to make the current wedge activate quickly enough that real families will pay for it.


## Repo Fit Constraints (Current Codebase)

Before executing any activation phase, align to these repo realities:

- Vercel + Supabase environment strategy is already defined in `path_to_deployment`; activation work should build on it, not re-scope it.
- Auth/workspace hardening and RLS assumptions from deployment phases are prerequisites for activation changes that touch onboarding, learner switching, or data isolation.
- Stripe implementation ownership must be explicit to avoid split planning between activation Phase 5 and deployment Phase 9.

Detailed phase-by-phase fit review: [repo_fit_phase_review.md](./repo_fit_phase_review.md).

## Product Promise

Turn messy homeschool inputs into a clear teachable day, adapt when life happens, and keep records automatically.

## Launch User

The launch user is a homeschooling parent who runs day-to-day instruction, uses mixed curriculum inputs, and is tired of manually re-planning the week.

Typical launch household:

- 1 to 3 learners
- books + printables + online tools + homemade lessons
- no clean export of the whole curriculum
- frequent plan drift
- parent wants a clearer Today, not a giant setup project

## Supporting Docs

- [phase0_launch_scope_and_activation_model.md](./phase0_launch_scope_and_activation_model.md)
- [phase1_fast_path_onboarding.md](./phase1_fast_path_onboarding.md)
- [phase1_fast_path_checklist.md](./phase1_fast_path_checklist.md)
- [phase2_curriculum_intake_and_horizon_policy.md](./phase2_curriculum_intake_and_horizon_policy.md)
- [phase2_curriculum_intake_checklist.md](./phase2_curriculum_intake_checklist.md)
- [phase2_curriculum_intake_implementation.md](./phase2_curriculum_intake_implementation.md)
- [phase3_multi_learner_household_launch.md](./phase3_multi_learner_household_launch.md)
- [phase3_multi_learner_household_implementation.md](./phase3_multi_learner_household_implementation.md)
- [phase4_mobile_first_parent_runtime.md](./phase4_mobile_first_parent_runtime.md)
- [phase5_pricing_billing_and_value_proof.md](./phase5_pricing_billing_and_value_proof.md)
- [phase5_pricing_billing_and_value_proof_implementation.md](./phase5_pricing_billing_and_value_proof_implementation.md)
- [phase6_beta_metrics_and_go_no_go.md](./phase6_beta_metrics_and_go_no_go.md)

## Activation Progress Checklist

### Phase 0: Launch Scope And Activation Model

- [x] Lock the launch wedge around mixed-curriculum homeschool households.
- [x] Lock the v1 promise around Today + Week + automatic records.
- [x] Explicitly defer full curriculum integrations, marketplace, and broad standards logic.
- [x] Explicitly defer native iOS / Android apps.
- [x] Commit to phone-first responsive web and optional PWA polish instead.
- [x] Define the first-session activation event.
- [x] Define the first-week retention events.
- [x] Define the beta success thresholds and kill criteria.
- [x] Confirm platform prerequisites from `path_to_deployment` and lock Stripe implementation ownership (Activation Phase 5 vs Deployment Phase 9).

### Phase 1: Fast-Path Onboarding

- [x] Replace the one-pass household setup with a fast path that reaches Today first.
- [x] Reduce required fields to the minimum needed for a teachable first day.
- [x] Let users add household defaults after first value, not before.
- [x] Support multiple learners without forcing full setup for all learners up front.
- [x] Add a visible "what do you have today?" intake choice.
- [x] Add a preview generation step before full commit where possible.
- [x] Add analytics for onboarding drop-off and activation.

### Phase 2: Curriculum Intake And Horizon Policy

- [ ] Support multiple partial-input routes.
- [ ] Do not require whole-curriculum upload for activation.
- [ ] Add confidence-based scheduling rules so one day of material does not become a fake week.
- [ ] Generate Today, the next few days, or a full week based on input quality and scope.
- [ ] Allow quick correction before saving the generated plan.
- [ ] Preserve intake provenance and editable curriculum structure.
- [ ] Add clear user-facing language for each intake route.

### Phase 3: Multi-Learner Household Launch

- [ ] Make family accounts first-class from day 1.
- [ ] Keep one active learner workspace at a time.
- [ ] Add fast learner switching on phone and desktop.
- [ ] Allow the second learner to be added after the first learner reaches Today.
- [ ] Verify each learner has independent plan, progress, and curriculum state.
- [ ] Keep shared household settings secondary.

### Phase 4: Mobile-First Parent Runtime

- [ ] Make the parent path usable on phone for intake, Today, marking progress, and learner handoff.
- [ ] Remove desktop-only interaction assumptions from onboarding and Today.
- [ ] Tighten loading, retry, empty, and background-generation states for mobile.
- [ ] Add camera-friendly intake and evidence capture.
- [ ] Validate one-thumb completion flows for done / partial / skipped / moved.
- [ ] Consider light PWA treatment only after the core phone flow feels strong.

### Phase 5: Pricing, Billing, And Value Proof

- [ ] Define the household billing model.
- [ ] Align Stripe work with the launch wedge, not a broad future platform model.
- [ ] Decide trial vs demo vs founding-customer offer.
- [ ] Put pricing behind proven first-session activation, not before.
- [ ] Add billing copy that matches the wedge.
- [ ] Verify trial-to-paid and billing recovery flows.

### Phase 6: Beta, Metrics, And Go / No-Go

- [ ] Run a small beta with real homeschool families.
- [ ] Measure activation, week-1 retention, and willingness to pay.
- [ ] Run staged product QA on fast-path onboarding and multi-learner use.
- [ ] Review user feedback for onboarding friction, plan trust, and daily usefulness.
- [ ] Decide go / no-go using explicit thresholds.
- [ ] Only scale acquisition after activation and retention are proven.

## Current Recommendation

Work this in order:

1. lock the launch wedge and activation model
2. rebuild onboarding around fast access to Today
3. add partial-input intake routes and confidence-based scheduling
4. harden multi-learner family use
5. make the parent workflow phone-first
6. wire pricing and billing to the proven wedge
7. run a measured beta and decide go / no-go

## Current State

- `path_to_deployment` is already far along and should remain the operational source of truth for hosted launch readiness.
- The current product is structurally stronger than a thin planner, but activation is still too heavy for a paid launch.
- The current onboarding path still behaves like a full household setup flow before the user reaches Today.
- The launch risk is not missing AI capability. The launch risk is failing to deliver value fast enough.

## How To Use This Folder

- Treat this folder as the activation and paid-launch source of truth.
- Update the phase checklists as work starts and finishes.
- Keep final scope decisions explicit.
- When handing work to another agent, pair this folder with `docs/plans/path_to_deployment/README.md`.
- Use the beta scorecard in Phase 6 before committing to a paid public launch.
