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

### Initial setup click-through (Phase 0 + 1 fast path)

Run this exact sequence for each QA pass that touches onboarding:

1. Open `/auth/setup` and submit household creation.
   - Expected: setup completes and routes to `/onboarding`.
   - Report notes: capture whether routing was immediate and whether any auth/session errors appeared.
2. On `/onboarding` Step 1, enter one learner name and continue.
   - Expected: learner name is required; continue stays disabled when empty.
   - Report notes: include the exact learner name used for reproducibility.
3. Step 2, choose one intake route:
   - `I have a book or curriculum`
   - `I have an outline or weekly plan`
   - `Start from a topic`
   - Expected: one option can be selected clearly; “add another learner later” is visible.
   - Report notes: record which route was tested.
4. Step 3, enter source input and choose horizon intent.
   - Expected: `Use this for just today` and auto horizon options are both visible.
   - Report notes: capture source text length/scope (short topic, weekly outline, etc.).
5. Submit generation.
   - Expected: generation/loading state is visible and no blocking runtime errors occur.
   - Report notes: include request latency estimate and any retries required.
6. If preview appears, validate preview details and continue.
   - Expected: learner target, proposed title, detected chunks, and horizon are visible.
   - Report notes: record whether preview was triggered by low/moderate confidence.
7. Verify redirect to `/today`.
   - Expected: active learner context is set, Today contains at least one actionable item, and the route is stable after refresh.
   - Report notes: confirm if refresh preserved learner context and whether any API requests failed.

For each run, explicitly report:
- ✅ what passed
- ❌ what failed
- ⚠️ what looked suspicious but non-blocking

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

Run this exact sequence for each QA pass that touches curriculum source intake:

1. Open `/curriculum` and move into `/curriculum/new`.
   - Expected: the add-source entry point is reachable without dead-end navigation.
   - Report notes: capture the exact route used to enter the flow.
2. On `/curriculum/new`, choose `Build from source`.
   - Expected: both paste and upload options are visible and selectable.
   - Report notes: record whether the active learner name is shown correctly in the page copy.
3. Upload one small file and submit.
   - Expected: the file summary renders, source preparation completes, and the resulting source or queued job advances without a generic upload error.
   - Report notes: include file type, approximate size, and whether the source landed on `/curriculum/[sourceId]` or entered the queued flow.
4. If testing hosted environments, repeat with a PDF larger than 4 MB.
   - Expected: curriculum upload still works on hosted because the browser uploads directly to storage; onboarding should show the explicit size-limit message instead of a generic failure.
   - Report notes: capture the exact PDF size, whether the request completed, and any plain-text `413` or storage auth errors in the network panel.

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
