# Homeschool V1 Checklist

## Parent Setup

- [ ] Parent can access the app using the existing auth/session path.
- [ ] Parent can create or edit household setup details.
- [ ] Parent can create learner profiles with age or grade context.
- [ ] Parent can save school year dates, school days, and time budget preferences.
- [ ] Parent can save planning and reporting preferences without leaving onboarding in a partial state.

## Curriculum Intake

- [ ] Parent can create curriculum manually.
- [ ] Parent can paste a structured outline and turn it into an editable curriculum tree.
- [ ] Parent can use AI-assisted decomposition to generate a curriculum tree from raw text.
- [ ] Imported or generated curriculum records lineage metadata.
- [ ] Parent can reorder, rename, trim, and keep using the resulting curriculum.

## Weekly Planning

- [ ] Parent can generate a week from curriculum plus household constraints.
- [ ] Parent can inspect and edit the week without internal product knowledge.
- [ ] Parent can move work across days.
- [ ] Parent can rebalance workload.
- [ ] Parent can recover from missed work with explicit life-happened actions.

## Daily Workspace

- [ ] Parent sees one clear daily workspace.
- [ ] Parent can mark items done, partial, skipped, or moved.
- [ ] Parent can generate a lesson draft or worksheet from the day surface.
- [ ] Parent can manually override planner decisions.
- [ ] Daily actions use homeschool-facing labels and plain language.

## Records And Reporting

- [ ] Parent can record attendance.
- [ ] Parent can add evidence or parent notes worth saving.
- [ ] Parent can review subject progress summaries.
- [ ] Parent can view a weekly summary.
- [ ] Parent can view a monthly summary.
- [ ] Parent can export a progress report.
- [ ] Parent can generate a transcript skeleton for older learners.

## Hardening

- [ ] Long-running generation uses the async job path.
- [ ] Artifact regeneration keeps history.
- [ ] Important mutations emit a basic audit event.
- [ ] Basic analytics and error-monitoring hooks exist.
- [ ] Pilot-readiness docs exclude auth/audio work and call out remaining gaps.
