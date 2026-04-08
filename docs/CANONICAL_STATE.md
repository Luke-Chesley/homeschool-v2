# Canonical State

## Source Of Truth

### Curriculum

The curriculum source and curriculum tree are the source of truth for what can be scheduled.

- `curriculum_sources` stores the parent-facing source record and lineage metadata.
- `curriculum_items` and curriculum routing nodes store the editable schedulable structure.
- Generated curriculum artifacts are inputs into the canonical tree, not the canonical tree itself.

### Weekly And Daily Plan

The weekly route is the source of truth for the intended week sequence.

- Weekly route items are the canonical weekly planning objects.
- The today workspace materializes daily plan items from the active weekly route.
- Daily workspace records may cache labels and schedule details for execution, but they should remain traceable back to the weekly route item.

### Session Completion

Session completion does mutate plan state, but only through explicit state transitions.

- Marking a session `completed`, `partial`, `skipped`, `moved`, or `carried forward` changes execution state.
- Completion does not rewrite curriculum structure.
- Completion may update weekly route item state, plan item state, lesson session state, and derived progress summaries.

### Progress Records

Progress records are derived from execution evidence plus explicit parent decisions.

- Progress is not inferred from a plan item merely existing on the calendar.
- Parent actions in the daily workspace are authoritative signals.
- Evidence, session outcomes, and parent notes are inputs to progress summaries and reports.

### Generated Artifacts

Generated artifacts are disposable unless explicitly promoted.

- Lesson drafts, worksheets, and AI-generated decomposition artifacts are versioned working artifacts.
- The editable curriculum tree and explicit execution records remain authoritative.
- Generated artifacts can be regenerated, superseded, or discarded while preserving lineage.

## Stored Vs Recomputed

### Stored

- curriculum sources and editable curriculum tree
- weekly routes and route overrides
- today workspace plan items and lesson sessions
- parent decisions on completion state
- evidence, notes, attendance, exports, and preferences
- artifact lineage and AI job records

### Recomputed

- dashboards
- weekly recommendations
- progress summaries
- monthly rollups
- export previews

## Invariants

- A schedulable item must trace back to a curriculum source or an explicit homeschool override.
- A weekly route item can be planned without being completed.
- A completed session must reference a concrete lesson session record.
- A progress summary must be explainable from stored execution records.
- Generated artifacts may not silently replace canonical curriculum structure.
- Parent overrides always win over planner suggestions.

## Allowed Transitions

### Weekly Route / Plan Item

- `planned -> done`
- `planned -> partial`
- `planned -> skipped`
- `planned -> moved`
- `partial -> done`
- `partial -> moved`
- `skipped -> rescheduled`

### Lesson Session

- `planned -> in_progress`
- `in_progress -> completed_as_planned`
- `in_progress -> partially_completed`
- `in_progress -> skipped`
- `in_progress -> needs_follow_up`

### Artifacts

- `queued -> generating -> ready`
- `queued|generating -> failed`
- `ready -> superseded`
- `ready|superseded -> archived`
