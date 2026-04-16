# Codebase Review TODO

Reviewed on 2026-03-30.

Scope reviewed:
- product docs and repo metadata
- app routes and API handlers under `app/`
- feature components under `components/`
- domain, AI, activity, curriculum, planning, tracking, auth, env, and DB code under `lib/`
- local scripts and platform config

Verification snapshot from the canonical main checkout at `/home/luke/Desktop/learning/homeschool-v2`:
- `corepack pnpm typecheck` fails because `tsconfig.json` still hard-requires missing `.next/types/**/*.ts` files.
- `corepack pnpm build` no longer fails on `/curriculum`, but it now fails during page-data collection with `PageNotFoundError` for `/api/users` and `/api/activities/attempts/[attemptId]/submit`.
- `git status` and `git worktree list` both work normally again from the main checkout.

## Checked Off Since The Last Review

- [x] Fix the production build blocker on `/curriculum`.
  Evidence: `app/(parent)/curriculum/page.tsx` now renders `CurriculumSourceCard` as a presentational child inside `Link`, and `components/curriculum/CurriculumSourceCard.tsx` no longer carries click/keyboard handlers through a server-rendered path.

- [x] Fix repo/worktree metadata so normal git operations work again.
  Evidence: `git status` and `git worktree list` run successfully from `/home/luke/Desktop/learning/homeschool-v2`.

- [x] Remove hard-coded demo household and learner IDs from route surfaces and resolve them from session state.
  Evidence: the reviewed route surfaces now use `requireAppSession()` instead of wiring `household-demo` / `learner-demo` directly in the page or route layer.
  Files checked: `app/(parent)/curriculum/page.tsx`, `app/(parent)/curriculum/new/page.tsx`, `app/(learner)/page.tsx`, `app/(learner)/activity/[sessionId]/page.tsx`, `app/api/curriculum/sources/route.ts`, `app/api/ai/chat/route.ts`
  Notes: demo IDs still exist in activity fixtures/local seed data, but not in the route surface that users hit.

- [x] Put persistence behind activity attempts, copilot sessions, and reporting handoff.
  Evidence: `lib/activities/attempt-store.ts` and `lib/ai/copilot-store.ts` now go through `lib/db/*`, and `reportOutcome()` writes durable tracking records instead of logging a stub.

- [x] Unify runtime AI routing with displayed routing.
  Evidence: `lib/ai/registry.ts` now resolves providers through `getAiRoutingConfig()` and registers Anthropic when configured, while `lib/ai/task-service.ts` selects models from the same routing config that the copilot page displays.

- [x] Register a real provider adapter or hide provider/model badges until the runtime is real.
  Evidence: `lib/ai/registry.ts` now registers `AnthropicAdapter` when `ANTHROPIC_API_KEY` is present, so the runtime is no longer mock-only.

## P0 - Fix These First

- [ ] Repair TypeScript verification so a fresh checkout can actually typecheck.
  Evidence: `corepack pnpm typecheck` fails on missing generated files under `.next/types/**`, including `app/layout.ts`, multiple App Router route entries, and `.next/types/cache-life.d.ts`.
  Files: `tsconfig.json`
  Notes: stop hard-requiring stale generated files, or add a supported `next typegen` step before typecheck.

- [ ] Fix the current production build blocker during API route collection.
  Evidence: `corepack pnpm build` fails with `PageNotFoundError` while collecting page data for `/api/users` and `/api/activities/attempts/[attemptId]/submit`.
  Files: `app/api/users/route.ts`, `app/api/activities/attempts/[attemptId]/submit/route.ts`, build/runtime config around App Router route collection
  Notes: this replaced the old `/curriculum` build blocker as the active build failure.

## P1 - Replace Demo Plumbing With Real App Plumbing

- [ ] Stop serving core product data from mock repositories when Drizzle repositories already exist.
  Evidence: planning and tracking still read from mock repositories even though `lib/db/repositories/*` exists, while activities have already moved to DB-backed local persistence.
  Files: `lib/curriculum/service.ts`, `lib/planning/service.ts`, `lib/tracking/service.ts`, `lib/planning/mock-repository.ts`, `lib/tracking/mock-repository.ts`
  Notes: the app is now mixed-mode instead of purely in-memory, which is better, but still inconsistent.

- [ ] Replace the temporary app-session cookie scaffold with real auth.
  Evidence: `requireAppSession()` now protects routes, but the active session is still assembled from custom cookies and local user service state instead of Supabase auth/session primitives.
  Files: `lib/app-session/server.ts`, `lib/users/service.ts`, `lib/auth/server.ts`, `lib/auth/browser.ts`, `lib/platform/supabase.ts`, route files under `app/`

## P1 - Make AI Behavior Match What The UI Claims

- [ ] Fix the structured-output contract for standards suggestion.
  Evidence: `suggestStandardsWithAI()` calls `completeJson()`, but the mock `standards.suggest` response in `lib/ai/mock-adapter.ts` is still markdown, not JSON, so the mock path parses to `null` and returns `[]`.
  Files: `lib/ai/task-service.ts`, `lib/ai/mock-adapter.ts`, `lib/prompts/store.ts`

- [ ] Harden the chat streaming protocol and client parser.
  Evidence: `CopilotChat` still splits raw chunks by newline without buffering partial SSE frames and swallows `event.error` inside a broad parse catch.
  Files: `components/copilot/CopilotChat.tsx`, `app/api/ai/chat/route.ts`
  Notes: stream errors are still easy to lose and chunk boundaries are handled unsafely.

- [ ] Either implement copilot actions end-to-end or remove the dead UI for now.
  Evidence: `CopilotActionCard` and action state still exist, but no response path actually populates actions into the UI.
  Files: `components/copilot/CopilotChat.tsx`, `components/copilot/CopilotActionCard.tsx`, `lib/ai/copilot-store.ts`, `lib/ai/types.ts`

- [ ] Finish the async generation pipeline or stop pretending jobs are running.
  Evidence: `/api/ai/generate` still returns a job ID from a stub dispatch path, there is still no visible `api/inngest` route or persisted job lifecycle, and `GenerateButton` still parks in a permanent `Generating…` state once dispatched.
  Files: `app/api/ai/generate/route.ts`, `components/copilot/GenerateButton.tsx`, `lib/ai/task-service.ts`, `lib/platform/config.ts`

## P2 - Finish Incomplete Product Flows

- [ ] Replace broken curriculum links with real routes or remove them.
  Evidence: the source detail page still links to `/curriculum/[sourceId]/units/new`, but no such route exists under `app/`.
  Files: `app/(parent)/curriculum/[sourceId]/page.tsx`, `app/`

- [ ] Finish standards mapping so selected standards can actually be attached to objectives.
  Evidence: the standards page still only tracks local `selectedIds`; the CTA remains disabled and there is no objective-selection flow.
  Files: `app/(parent)/curriculum/[sourceId]/standards/page.tsx`, `components/curriculum/StandardsBrowser.tsx`, curriculum service/repository files

- [ ] Replace the upload and AI-draft curriculum intake stubs with real storage and generation flows.
  Evidence: `AddSourceModal` still contains placeholder flows rather than real upload or AI-draft processing.
  Files: `components/curriculum/AddSourceModal.tsx`, `lib/storage/*`, `lib/curriculum/service.ts`

- [ ] Connect planning, today, and tracking views to live dates and live data.
  Evidence: `getTodayWorkspace()` still defaults to the fixed `"2026-03-30"` and planning/tracking still lean on mock snapshots.
  Files: `lib/planning/service.ts`, `lib/planning/mock-repository.ts`, `lib/tracking/service.ts`, `lib/tracking/mock-repository.ts`

- [ ] Decide whether learner surfaces live at `/`, under a dedicated learner prefix, or behind a separate entry flow.
  Evidence: learner pages, parent pages, and the landing page are all present, but the navigation/story for entering each mode is still unclear.
  Files: `app/page.tsx`, `app/(learner)/*`, `app/(parent)/*`, `components/navigation/global-page-tabs.tsx`

## P3 - Correctness And Cleanup

- [ ] Fix the `immediateFeeback` typo before this leaks into stored schemas or generated content.
  Files: `lib/activities/types.ts`, `lib/activities/fixtures.ts`

- [ ] Remove or replace remaining stub-only logging once real integrations land.
  Evidence: AI generation dispatch is still a stub log path, and there may still be placeholder logs in curriculum-side processing even though activity outcome reporting is now real.
  Files: `lib/curriculum/service.ts`, `lib/ai/task-service.ts`

- [ ] Add automated verification for the app's critical paths.
  Minimum bar:
  - build succeeds in CI
  - typecheck works from a clean checkout
  - curriculum page renders
  - AI chat route streams valid SSE
  - activity attempt lifecycle persists and reports outcomes

## Suggested Order

1. Fix typecheck and the new API-route build failure.
2. Replace the temporary app-session scaffold with real auth/session plumbing.
3. Finish moving planning/tracking/curriculum flows off mock repositories.
4. Finish AI runtime gaps: structured output, SSE robustness, actions, and async generation.
5. Close the broken curriculum/planning flows and clean up remaining typos/logging.
