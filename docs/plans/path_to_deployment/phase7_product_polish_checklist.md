# Phase 7: Product Polish Checklist

Use this alongside [phase7_product_polish_and_account_surfaces.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_product_polish_and_account_surfaces.md) and [phase7_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_surface_inventory.md).

## Phase Status

- [x] Phase 7 planning started
- [x] Phase 7 implementation started
- [x] Phase 7 reviewed on a branch build
- [ ] Phase 7 merged to `stage`
- [ ] Phase 7 merged to `main`

## Product Direction

- [x] Confirm Phase 7 extends the current product language instead of creating a new one.
- [x] Keep the parent chrome quiet and compact.
- [x] Keep copy direct and minimal.
- [x] Keep studio/debug affordances secondary.

## Account Surface

- [x] Replace the current placeholder framing on `/account`.
- [x] Add a credible household/account structure.
- [x] Surface current household information clearly.
- [x] Add clear placeholders for future billing/admin areas without making the page feel fake.
- [x] Add at least one useful current action or next-step entry point.
- [x] Keep billing future-state messaging visually secondary.

## Tracking Surface

- [x] Review `TrackingShell` hierarchy and spacing.
- [x] Reduce unnecessary descriptive copy.
- [x] Standardize empty states, section headers, and supporting text.
- [x] Tighten table/list/filter behavior if needed.
- [x] Ensure recommendations, evidence, and attendance feel practical rather than dashboard-like.
- [x] Keep the page aligned with the calmer Phase 5 parent language.

## Auth And Setup

- [x] Review `/auth/login` spacing and hierarchy.
- [x] Review `/auth/sign-up` spacing and hierarchy.
- [x] Review `/auth/setup` spacing and hierarchy.
- [x] Standardize input, helper text, and error-state treatment.
- [x] Reduce extra copy in auth/setup flows.
- [x] Make auth/setup feel like the same product as the main app.

## Cross-Surface Consistency

- [x] Standardize section header behavior across parent surfaces.
- [x] Standardize empty-state tone and action placement.
- [x] Standardize disclosure patterns where secondary detail exists.
- [ ] Standardize search/filter placement where used.
- [ ] Standardize save-state and feedback treatment where used.
- [x] Review `Today`, `Planning`, `Curriculum`, `Tracking`, `Copilot`, and `Account` for obvious inconsistencies.

## Verification

- [x] Run `corepack pnpm typecheck`.
- [x] Review `/account` in the browser.
- [x] Review `/tracking` in the browser.
- [x] Review `/auth/login`, `/auth/sign-up`, and `/auth/setup` in the browser.
- [x] Do one cross-surface visual pass across the main parent routes.

## Documentation

- [x] Update [docs/plans/path_to_deployment/README.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/README.md) as Phase 7 starts and finishes.
- [x] Keep [phase7_product_polish_and_account_surfaces.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_product_polish_and_account_surfaces.md) current if implementation decisions change.
- [x] Keep [phase7_surface_inventory.md](/home/luke/Desktop/homeschool-v2/docs/plans/path_to_deployment/phase7_surface_inventory.md) current if scope changes.

## Deferrals

- [x] Record any billing, Stripe, or account-backend implementation deferrals before moving to launch prep.
- [ ] Record any remaining Phase 6 responsive QA findings that must be folded into launch prep.
