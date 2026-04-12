# Phase 7: Product Polish Checklist

Use this alongside [phase7_product_polish_and_account_surfaces.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_product_polish_and_account_surfaces.md) and [phase7_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_surface_inventory.md).

## Phase Status

- [ ] Phase 7 planning started
- [ ] Phase 7 implementation started
- [ ] Phase 7 reviewed on a branch build
- [ ] Phase 7 merged to `stage`
- [ ] Phase 7 merged to `main`

## Product Direction

- [ ] Confirm Phase 7 extends the current product language instead of creating a new one.
- [ ] Keep the parent chrome quiet and compact.
- [ ] Keep copy direct and minimal.
- [ ] Keep studio/debug affordances secondary.

## Account Surface

- [ ] Replace the current placeholder framing on `/account`.
- [ ] Add a credible household/account structure.
- [ ] Surface current household information clearly.
- [ ] Add clear placeholders for future billing/admin areas without making the page feel fake.
- [ ] Add at least one useful current action or next-step entry point.
- [ ] Keep billing future-state messaging visually secondary.

## Tracking Surface

- [ ] Review `TrackingShell` hierarchy and spacing.
- [ ] Reduce unnecessary descriptive copy.
- [ ] Standardize empty states, section headers, and supporting text.
- [ ] Tighten table/list/filter behavior if needed.
- [ ] Ensure recommendations, evidence, and attendance feel practical rather than dashboard-like.
- [ ] Keep the page aligned with the calmer Phase 5 parent language.

## Auth And Setup

- [ ] Review `/auth/login` spacing and hierarchy.
- [ ] Review `/auth/sign-up` spacing and hierarchy.
- [ ] Review `/auth/setup` spacing and hierarchy.
- [ ] Standardize input, helper text, and error-state treatment.
- [ ] Reduce extra copy in auth/setup flows.
- [ ] Make auth/setup feel like the same product as the main app.

## Cross-Surface Consistency

- [ ] Standardize section header behavior across parent surfaces.
- [ ] Standardize empty-state tone and action placement.
- [ ] Standardize disclosure patterns where secondary detail exists.
- [ ] Standardize search/filter placement where used.
- [ ] Standardize save-state and feedback treatment where used.
- [ ] Review `Today`, `Planning`, `Curriculum`, `Tracking`, `Copilot`, and `Account` for obvious inconsistencies.

## Verification

- [ ] Run `corepack pnpm typecheck`.
- [ ] Review `/account` in the browser.
- [ ] Review `/tracking` in the browser.
- [ ] Review `/auth/login`, `/auth/sign-up`, and `/auth/setup` in the browser.
- [ ] Do one cross-surface visual pass across the main parent routes.

## Documentation

- [ ] Update [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) as Phase 7 starts and finishes.
- [ ] Keep [phase7_product_polish_and_account_surfaces.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_product_polish_and_account_surfaces.md) current if implementation decisions change.
- [ ] Keep [phase7_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_surface_inventory.md) current if scope changes.

## Deferrals

- [ ] Record any billing, Stripe, or account-backend implementation deferrals before moving to launch prep.
- [ ] Record any remaining Phase 6 responsive QA findings that must be folded into launch prep.
