# QA Flow Inventory

Use this as the source-of-truth checklist for which app surfaces need recurring QA coverage.

## Public Entry

Routes:
- `/`
- `/auth/login`
- `/auth/sign-up`
- `/auth/confirm`
- `/auth/error`

Core expectations:
- landing page loads
- login works with a valid adult account
- sign-up either succeeds or fails with a clear reason
- confirmation flow returns the user to the app cleanly
- auth error state is understandable

## Initial Setup

Routes:
- `/auth/setup`
- `/onboarding`

Core expectations:
- newly authenticated users are routed into setup correctly
- workspace creation is clear
- learner creation/setup is understandable
- completion routes the user into the app without confusion

## Parent Workspace

Routes:
- `/today`
- `/planning`
- `/curriculum`
- `/copilot`
- `/tracking`
- `/account`

Core expectations:
- authenticated users land in a useful workspace, not a dead end
- top-level navigation is stable and readable
- `Today` exposes the next meaningful action
- supporting workspaces feel connected to `Today`

## Curriculum And Planning

Routes:
- `/curriculum`
- `/curriculum/new`
- `/curriculum/manage`
- `/curriculum/graph`
- `/planning`
- `/planning/month`

Core expectations:
- curriculum source creation/import works
- planning state is reachable and understandable
- generated or planned work becomes visible from `Today`
- empty states guide the user toward a real next action

## Learner Flow

Routes:
- `/learner`
- `/activity/[sessionId]`

Core expectations:
- learner queue is readable
- next activity is obvious
- activity runtime is usable on laptop, tablet, and phone
- completion and recovery states are clear
- studio mode remains secondary

## Tracking And Account

Routes:
- `/tracking`
- `/tracking/reports`
- `/account`
- `/users`

Core expectations:
- household and records surfaces feel practical, not decorative
- attendance/reporting states are readable
- account settings are clear
- learner management is reachable

## Copilot

Routes:
- `/copilot`
- `POST /api/ai/chat`

Core expectations:
- Copilot loads without runtime errors
- chat flow is usable
- service failures degrade gracefully
- conversation UI stays aligned with the rest of the app

## API-Backed Product Risks

High-value API areas to watch during browser QA:
- `/api/app-session`
- `/api/auth/setup`
- `/api/curriculum/sources`
- `/api/planning/weekly-route`
- `/api/activities/attempts`
- `/api/ai/chat`
- `/api/ai/lesson-plan`

Core expectations:
- no blocking failed requests during main flows
- auth/session APIs behave consistently
- server errors are surfaced clearly when they do occur

## Responsive Coverage

Every recurring QA pass should cover at least:
- one laptop viewport
- one tablet viewport
- one phone viewport

Minimum responsive route set:
- `/today`
- `/learner`
- `/activity/[sessionId]`

Secondary responsive routes:
- `/auth/login`
- `/curriculum`
- `/copilot`
- `/tracking`
- `/account`
