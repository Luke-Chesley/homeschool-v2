# Phase 2: Curriculum Intake Checklist

## Input Routes

- [ ] Support single-lesson / chapter input.
- [ ] Support weekly assignment list input.
- [ ] Support pasted outline / TOC input.
- [ ] Support topic-from-scratch input.
- [ ] Keep manual starter shell as fallback.

## Horizon Policy

- [ ] Define default horizon for each route.
- [ ] Prevent weak input from auto-generating an overconfident week.
- [ ] Allow user override of horizon when appropriate.
- [ ] Persist the chosen horizon and whether it was inferred or user-selected.

## Preview And Correction

- [ ] Show interpreted source summary.
- [ ] Show target learner.
- [ ] Show proposed horizon.
- [ ] Allow quick correction before or right after save.
- [ ] Handle generation failure with retry and source editing.

## Data And Domain

- [ ] Persist route type.
- [ ] Persist raw source or file reference.
- [ ] Persist confidence metadata.
- [ ] Persist user overrides.
- [ ] Support regeneration without trashing valid progress.

## UX And Copy

- [ ] Replace internal route names with parent-facing language.
- [ ] Explain assumptions briefly when confidence is low.
- [ ] Make "build today" the safest default when input scope is unclear.
- [ ] Keep the route picker simple on phone widths.

## QA

- [ ] Single chapter generates Today, not a fake week.
- [ ] Weekly list generates a sensible week.
- [ ] Outline generates next few days with editable structure.
- [ ] Topic route generates a bounded starter module.
- [ ] Regeneration preserves existing completed work correctly.
- [ ] Mobile upload / paste flow works without layout breakage.
