# Engineering Conventions for `homeschool-v2`

This document is the source of truth for how to write code in this repo without degrading the responsiveness of the app.

Read this before changing:
- `app/(parent)/today/page.tsx`
- `app/(parent)/today/actions.ts`
- `components/planning/today/*`
- `lib/planning/today-service.ts`
- `lib/planning/weekly-route-service.ts`
- `lib/app-session/server.ts`
- `lib/auth/server.ts`

The product promise depends on a calm, fast Today surface. The app should feel immediate on phone and desktop even when it is orchestrating AI work in the background.

## Core rule

**Pages render. Actions mutate. Narrow endpoints report status.**

Do not blur those roles.

## Cross-repo AI boundary

Keep the app and AI runtime responsibilities separate.

- `homeschool-v2` owns product state, approvals, persistence, scheduling, and UI.
- `learning-core` owns named AI operations, prompt construction, provider and model selection, prompt previews, lineage, and traces.
- Source-entry curriculum creation should follow the current chain: `source_interpret` -> `curriculum_generate` -> app-owned import and planning handoff.
- Do not move extracted prompt, provider, or model logic back into app routes, components, or server actions.

## Copilot rules

Copilot is a bounded product surface, not an unrestricted mutation channel.

- Copilot context is assembled by the app and sent to `learning-core` through typed envelopes.
- Any meaningful product mutation must go through an explicit app-side handler or dispatcher.
- Do not treat freeform chat text as permission to mutate planning, curriculum, tracking, or reporting state.
- If Copilot suggests an action, the action contract must stay narrow, typed, and reviewable.

## Eval expectations for AI-boundary changes

When changing onboarding, curriculum generation, Copilot, or other `learning-core`-backed flows:

- update the current-state docs in `README.md` or `docs/CURRENT_PRODUCT_AND_RUNTIME_MODEL.md` when the mental model changes
- keep the shared cross-repo architecture docs in sync when the boundary or handoff changes
- add or extend a repeatable check for the affected path instead of relying only on ad hoc manual testing
- treat billing-related surfaces as deferred unless the task is explicitly about billing

## 1. Read paths must stay read-first

Pages and read helpers should prefer read-only assembly.

### Good
- `app/(parent)/today/page.tsx` calls one read-oriented helper that encapsulates freshness checks and only materializes when needed.
- Request-scoped context is resolved once and reused.
- Read helpers return typed view models.

### Bad
- query-param mutations on page render
- doing hidden writes inside a page component
- resolving the same workspace context twice in one request path
- broad write-heavy sync work every time a page opens

### Project-specific note
`getTodayWorkspaceViewForRender(...)` is the current read-first entrypoint. Keep it that way. If you need new Today reads, add them beside it instead of reopening lower-level orchestration from the page.

## 2. Never mutate through URL query params

User actions must not be encoded as `?action=...` style route mutations.

### Good
- explicit server actions
- POST route handlers for narrow API actions
- local optimistic patch + background reconciliation

### Bad
- GET-driven mutations
- redirect-to-self mutation flows
- any interaction that requires a full page navigation just to save local card state

## 3. Keep the Today surface patch-oriented

The Today UI should update from small typed patches, not route-wide refreshes.

### Good
- action result types like `TodayPlanItemActionResult`
- local patch helpers
- background workspace patch retrieval for structural changes

### Bad
- `router.refresh()` after per-card actions
- rebuilding the whole Today tree because one card changed
- server actions that return nothing and force the client to rediscover state

### Project-specific note
If an action changes one card, return enough data to patch one card.
If an action changes structure, return an immediate optimistic patch and then fetch a background workspace patch.

## 4. Revalidation must be narrow and justified

`revalidatePath` is allowed, but treat it as expensive.

### Allowed
- schedule-shape changes that truly affect other server-rendered surfaces
- route expansion that changes Today and Planning together

### Usually not allowed
- revalidating `/planning`, `/tracking`, or `/tracking/reports` after a local Today card change
- broad invalidation when the client already has the correct patch data

### Review rule
Every `revalidatePath(...)` call should have a one-line code comment explaining why local patching is not enough.

## 5. Polling must be combined, bounded, and backoff-based

Polling is acceptable for AI build status. It must be narrow.

### Good
- one combined endpoint for related build state
- backoff schedules like `1s -> 2s -> 4s`
- polling that stops immediately when work is no longer active
- endpoints that return only the status payload needed by the current surface

### Bad
- multiple overlapping poll loops for related state
- polling entire pages
- full-route refresh loops
- endpoints that materialize unrelated state on every poll

### Project-specific note
Use `/api/today/build-status` for lesson/activity build state. Do not reintroduce separate polling loops in new components.

## 6. Structural actions should feel instant

Some actions genuinely change the shape of the day. That does not mean they should block the UI.

### Desired pattern
1. user triggers structural action
2. server action writes the minimal mutation
3. client applies an immediate optimistic patch
4. client fetches `/api/today/workspace-patch` in the background
5. workspace state is reconciled when the patch arrives

### Bad
- waiting for full workspace materialization before acknowledging the action
- tying structural actions to full page rerender

## 7. Keep client boundaries thin

Client components should orchestrate local interaction, not own large data assembly or duplicated view logic.

### Good
- a thin top-level client wrapper
- hooks for local state and polling
- small card/action modules under `components/planning/today/`

### Bad
- one giant client component owning the entire Today surface
- duplicating the same data transformation logic across client files
- hydrating more UI than the user can interact with immediately

### Project-specific note
The split under `components/planning/today/` is the model to continue:
- state hook
- polling hook
- shell
- action controls
- evaluation controls
- activity controls
- route shells

Prefer adding another small module over re-growing `today-workspace-view.tsx`.

## 8. Avoid no-op database churn

Do not update rows unless their persisted Today-facing state actually changed.

### Good
- compute desired persisted shape
- diff against existing row
- skip writes when there is no real change

### Bad
- updating every existing Today plan item on every sync
- touching `updatedAt` for no-op rows
- rereading canonical links/items when no create/link mutation happened

### Project-specific note
`buildTodayPlanItemUpdatePatch(...)` is the pattern to preserve. Any new sync logic should use the same dirty-checking discipline.

## 9. Separate context resolution, materialization, and view assembly

These are different responsibilities.

### Context resolution
Find the source, route board, selected route items, nodes, timing, and planning context.

### Materialization
Persist or repair the Today workspace when it is missing or stale.

### View assembly
Load the typed `DailyWorkspace` for rendering.

### Rule
Do not collapse these three into one grab-bag helper.

### Project-specific note
If a new feature needs Today data, ask first:
- do I need context?
- do I need materialization?
- do I only need the view?

Pick the narrowest layer possible.

## 10. Route-board work is hot-path code

Anything touching weekly route-board reads for Today is performance-sensitive.

### Good
- read-safe fast paths
- request-local memoization
- reuse of already-resolved board/context within one request path

### Bad
- reconstructing the board multiple times in one page load
- doing maintenance/repair work on every Today read
- calling heavy route generation paths from narrow status endpoints

### Project-specific note
`getReadOptimizedWeeklyRouteBoardForToday(...)` should be preferred for Today reads. Any new route-board helper used by Today must justify why it is not read-safe.

## 11. AI work should be visible as state, not as UI theater

AI generation belongs in typed build/draft/activity state, not in opaque spinner-driven flows.

### Good
- lesson build state persisted and polled narrowly
- activity build state persisted and polled narrowly
- explicit draft/activity patches into local state

### Bad
- hidden fallback generation
- spinner with no persisted state
- UI that has to refresh the page to find out what happened

## 12. Auth/session helpers are infrastructure, not product logic

Do not mix product side effects into auth/session resolution.

### Good
- request-scoped caching for auth/session lookups
- read-only workspace/session resolution

### Bad
- publishing activities or mutating Today state while resolving session/auth
- duplicate session resolution inside one request path when avoidable

## 13. Add measurement with every hot-path change

If you touch Today, routing, polling, or workspace sync, add or preserve timing signals.

### Minimum requirement
Capture before/after for:
- `/today`
- `/api/today/build-status`
- `/api/today/workspace-patch`
- any new hot endpoint introduced by the change

### Good
- `Server-Timing` headers
- small structured logs for expensive operations
- short perf notes in docs when a refactor changes the data path

### Bad
- `"feels faster"` with no measurement
- deleting existing timing without replacement

## 14. Prefer typed patches and typed status payloads

All interaction boundaries should return narrow typed contracts.

### Good
- `TodayWorkspacePatch`
- `TodayPlanItemActionResult`
- `TodayPlanItemEvaluationResult`
- combined build-status payloads

### Bad
- generic `{ ok: true }` responses that force the client to refetch everything
- ad hoc JSON blobs with no stable shape

## 15. Project-specific anti-patterns to avoid

Never reintroduce these:
- `router.refresh()` loops for build polling
- GET query-param mutations on `/today`
- giant client-boundary regrowth around the Today surface
- broad `revalidatePath` on card-level writes
- syncing all Today items instead of only dirty items
- write-heavy work inside narrow status endpoints
- recomputing route/context multiple times in one request path when the same request already resolved it

## 16. Code review checklist for future agents

Before opening a PR, answer these explicitly:

1. Does this change make `/today` do more work on read?
2. Does this add any new unconditional writes on page render?
3. Does this broaden revalidation?
4. Does this increase polling frequency or polling scope?
5. Does this enlarge a client boundary unnecessarily?
6. Does this add duplicate context/session resolution?
7. Does this skip dirty-checking before writes?
8. Does it return typed patch/status payloads?
9. What are the before/after timings?
10. If this is slower, what user-visible benefit justifies it?

## 17. Suggested task framing for future agents

When handing off work, prefer wording like:
- `"keep Today read-first"`
- `"return a narrow patch, not a full refresh"`
- `"do not broaden invalidation"`
- `"preserve dirty-checking and no-op skip behavior"`
- `"measure before/after with Server-Timing or equivalent"`

Avoid vague prompts like:
- `"clean this up"`
- `"make it simpler"`
- `"refactor for readability"`

This repo is sensitive to architectural regressions that look cleaner but make the app slower.

## 18. Current reference files

Use these as the concrete examples of the preferred patterns:
- `app/(parent)/today/page.tsx`
- `app/(parent)/today/actions.ts`
- `app/api/today/build-status/route.ts`
- `app/api/today/workspace-patch/route.ts`
- `components/planning/today/use-today-workspace-state.ts`
- `components/planning/today/use-today-build-status-polling.ts`
- `components/planning/today/today-workspace-shell.tsx`
- `lib/planning/today-service.ts`
- `lib/planning/weekly-route-service.ts`

If you are about to change one of those files, reread this document first.
