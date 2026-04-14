# Path To Activation Launch — Repo Fit Review (Vercel + Supabase + Stripe)

## Why this document exists

The activation launch phases were drafted as a product strategy track.
This review maps each phase to the **current repository reality** so execution matches existing architecture and deployment constraints.

Use this with:

- `docs/plans/path_to_activation_launch/*`
- `docs/plans/path_to_deployment/*`

## Current platform baseline in this repo

- **Hosting and environments are already Vercel-oriented** with local/staging/production environment planning documented and inventoried.
- **Auth + data are already Supabase-first** (SSR auth clients, service-role boundaries, RLS verification script, and environment matrix).
- **Stripe billing is explicitly deferred** in the deployment track (Phase 9) and only placeholder Account copy exists in-product today.

The activation plan should therefore avoid re-planning platform fundamentals and focus on product activation, while pulling in Stripe work only when Phase 5 is reached.

---

## Phase-by-phase fit adjustments

## Phase 0 — Launch Scope And Activation Model

### Keep as-is
- Wedge definition and Today-first framing are aligned with current product direction.

### Update for repo fit
- Treat **Vercel + Supabase architecture as fixed launch infrastructure**, not an open question.
- Add explicit dependency: activation work assumes completed `path_to_deployment` phases for auth/workspace hardening and hosted env setup.
- Clarify that monetization design in this phase is **policy-level only** (household unit, learner caps), not Stripe implementation.

### Implementation note
- Add one “platform prerequisite” checkbox to Phase 0/README linking to deployment phase completion state.

---

## Phase 1 — Fast-Path Onboarding

### Keep as-is
- Progressive onboarding and “reach Today first” are the right goals.

### Update for repo fit
- Reuse existing `/auth/setup` + `/today` flow surfaces; do not introduce a second onboarding stack.
- Preserve current Supabase-backed workspace/session assumptions; onboarding milestones should extend existing domain objects rather than create parallel identity state.
- Instrument onboarding milestones through the existing observability layer before adopting any external analytics vendor.

### Implementation note
- Add explicit “no duplicate auth model” constraint: no bypass of SSR auth + membership resolution.

---

## Phase 2 — Curriculum Intake And Horizon Policy

### Keep as-is
- Input-route and confidence/horizon policy are strongly aligned with current curriculum/planning model.

### Update for repo fit
- Ensure route metadata is persisted in existing learner-scoped curriculum/planning records, not in ad-hoc side storage.
- Keep generation/resume behavior compatible with current Today/Planning services and route APIs.
- For uploads, prioritize the existing Supabase storage path and ownership rules.

### Implementation note
- Add checklist item to validate RLS-safe read/write behavior for any new intake metadata tables/columns.

---

## Phase 3 — Multi-Learner Household Launch

### Keep as-is
- Household billing unit + active learner operational model matches current product structure.

### Update for repo fit
- Build on existing active-learner workspace preference behavior (cookies as preference, not identity).
- Validate learner switching against current parent route group and app-session flows rather than adding a new global state system.
- Treat per-learner isolation as a Supabase authorization/data-scoping verification task as much as a UX task.

### Implementation note
- Add “verify against Phase 2/3 auth and RLS assumptions” gate to Phase 3 exit criteria.

---

## Phase 4 — Mobile-First Parent Runtime

### Keep as-is
- Responsive-web-first (not native app) is correct for the repo and launch timeline.

### Update for repo fit
- Validate mobile flows on deployed Vercel previews as well as localhost to catch environment-specific upload/auth behavior.
- Keep camera/evidence flows within browser capabilities and current storage model.
- If PWA polish is attempted, treat it as constrained optional work after core phone flows pass.

### Implementation note
- Add a required QA pass for `/today`, `/planning`, `/curriculum`, and learner switch on phone widths in the existing QA docs flow.

---

## Phase 5 — Pricing, Billing, And Value Proof

### Keep as-is
- Household-plan framing and value-before-paywall sequencing are right.

### Update for repo fit
- Reconcile with deployment track: Stripe backend work is currently documented under `path_to_deployment/phase9_billing_and_stripe.md`.
- Decide whether to:
  1. pull minimal Stripe implementation forward into Activation Phase 5, or
  2. keep Activation Phase 5 as pricing policy + experiments and leave implementation in Deployment Phase 9.
- Keep Account surface evolution consistent with current placeholder messaging and avoid fake billing UX.

### Implementation note
- Add a cross-plan decision record: “Stripe implementation owner phase” with a single source of truth to prevent split execution.

---

## Phase 6 — Beta, Metrics, And Go / No-Go

### Keep as-is
- Beta cohort sizing and go/no-go thresholds are reasonable.

### Update for repo fit
- Tie activation metrics to concrete in-app events that can be logged today (first Today load, first item status change, second learner add, etc.).
- Run beta validation against the deployed environment path (Vercel + Supabase) early, not only local dev.
- Include billing-state branching in metrics only if Stripe is live for the beta cohort; otherwise track willingness-to-pay intent explicitly.

### Implementation note
- Add two beta modes:
  - **Mode A** (no live Stripe): willingness-to-pay + founder commitments.
  - **Mode B** (live Stripe): trial start, conversion, recovery metrics.

---

## Cross-plan decisions to lock now

1. **Stripe placement decision**
   - confirm whether implementation stays in deployment Phase 9 or moves into activation Phase 5.
2. **Single instrumentation path**
   - define where activation events are persisted first (existing observability/audit path), and defer vendor analytics until signal quality is proven.
3. **Environment-of-truth for launch decisions**
   - launch-readiness decisions should be based on staged/prod-like Vercel+Supabase behavior, not only localhost checks.

---

## Recommended next step

Update `docs/plans/path_to_activation_launch/README.md` with a short “Repo Fit Constraints” section and link this review so every phase owner executes against the same assumptions.
