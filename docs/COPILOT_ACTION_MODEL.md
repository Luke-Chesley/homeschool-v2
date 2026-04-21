# Copilot Action Model

This document describes the current bounded Copilot action path in `homeschool-v2`.

## Current contract

`learning-core` returns a structured `copilot_chat` artifact:

- `answer: string`
- `actions: CopilotActionDraft[]`

The app persists each returned action into `copilot_actions`, assigns the durable app-side action id, and streams the persisted actions back to the client after the assistant answer deltas.

## Supported action kinds

The current registry is intentionally small.

### `planning.adjust_day_load`

Purpose:
- move one specific weekly route item to a lighter date when the current week is overloaded

App-side handler:
- `moveWeeklyRouteItem`

Required payload:
- `weeklyRouteId`
- `weeklyRouteItemId`
- `currentDate`
- `targetDate`
- `targetIndex`
- `reason`

### `planning.defer_or_move_item`

Purpose:
- defer one specific weekly route item or move it to a different day

App-side handler:
- `moveWeeklyRouteItem`

Required payload:
- `weeklyRouteId`
- `weeklyRouteItemId`
- `currentDate`
- `targetDate`
- `targetIndex`
- `reason`

### `planning.generate_today_lesson`

Purpose:
- generate or regenerate the lesson draft for a specific day already in scope

App-side handler:
- `generateTodayLessonDraft`

Required payload:
- `date`
- `slotId` when the current day exposes a specific slot
- `reason`

### `tracking.record_note`

Purpose:
- save one durable observation note into tracking

App-side handler:
- `recordObservationNote`

Required payload:
- `body`
- `noteType`
- optional `title`
- optional `planItemId`
- optional `lessonSessionId`

## Approval model

Copilot does not mutate state directly.

Every returned action is:

1. proposed by `learning-core`
2. validated by the app against the bounded action schema
3. persisted in the Copilot store with `pending` status
4. shown in the UI with explicit approval copy
5. applied only through `POST /api/copilot/actions/apply`

The apply route:

- loads the persisted action for the authenticated household and learner
- validates the action shape again
- marks the action `applying`
- dispatches to a real product handler
- stores `applied` or `failed` with a structured result or error

Dismissal goes through `POST /api/copilot/actions/dismiss` and persists `dismissed`.

## Streaming model

`POST /api/ai/chat` emits SSE events in this order:

1. `session`
2. one or more `delta`
3. `actions` when structured actions exist
4. `done`

The client does not invent actions locally. It renders only the persisted actions that come back from the server stream.

## Deliberate deferrals

These action kinds are intentionally not implemented in this pass:

- standards remap actions
- curriculum regeneration actions
- recommendation decision actions

They are deferred because the current Copilot context does not consistently expose the stable ids and bounded backend paths needed to apply them safely from Copilot without guesswork.
