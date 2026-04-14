# Phase 2: Curriculum Intake Checklist

## Input Routes

- [x] Support single-lesson / chapter input.
- [x] Support weekly assignment list input.
- [x] Support pasted outline / TOC input.
- [x] Support topic-from-scratch input.
- [x] Keep manual starter shell as fallback.

## Horizon Policy

- [x] Define default horizon for each route.
- [x] Prevent weak input from auto-generating an overconfident week.
- [x] Allow user override of horizon when appropriate.
- [x] Persist the chosen horizon and whether it was inferred or user-selected.

## Preview And Correction

- [x] Show interpreted source summary.
- [x] Show target learner.
- [x] Show proposed horizon.
- [x] Allow quick correction before or right after save.
- [ ] Handle generation failure with retry and source editing.

## Data And Domain

- [x] Persist route type.
- [x] Persist raw source or file reference.
- [x] Persist confidence metadata.
- [x] Persist user overrides.
- [ ] Support regeneration without trashing valid progress.

## UX And Copy

- [x] Replace internal route names with parent-facing language.
- [x] Explain assumptions briefly when confidence is low.
- [x] Make "build today" the safest default when input scope is unclear.
- [ ] Keep the route picker simple on phone widths.

## QA

- [ ] Single chapter generates Today, not a fake week.
- [ ] Weekly list generates a sensible week.
- [ ] Outline generates next few days with editable structure.
- [ ] Topic route generates a bounded starter module.
- [ ] Regeneration preserves existing completed work correctly.
- [ ] Mobile upload / paste flow works without layout breakage.
