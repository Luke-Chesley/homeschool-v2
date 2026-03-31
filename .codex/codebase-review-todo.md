# Codebase Review TODO

Reviewed on 2026-03-30.

Scope reviewed:
- product docs and repo metadata
- app routes and API handlers under `app/`
- feature components under `components/`
- domain, AI, activity, curriculum, planning, tracking, auth, env, and DB code under `lib/`
- local scripts and platform config

Verification snapshot:
- `./node_modules/.bin/tsc --noEmit` fails because `tsconfig.json` includes missing `.next/types/**/*.ts` files.
- `./node_modules/.bin/next build` fails while prerendering `/curriculum` because `components/curriculum/CurriculumSourceCard.tsx` passes event handlers from a server-rendered path.
- `git status` is broken in this workspace because `.git` points at a missing worktree path.

## P0 - Fix These First

- [ ] Fix the production build blocker on `/curriculum`.
  Evidence: `next build` fails with "Event handlers cannot be passed to Client Component props."
  Files: `app/(parent)/curriculum/page.tsx`, `components/curriculum/CurriculumSourceCard.tsx`
  Notes: `CurriculumSourceCard` mixes presentational rendering with `onClick` and keyboard handlers, then gets rendered from a server component inside `Link`. Split the interactive wrapper from the card body or make the interactive surface a client component intentionally.

- [ ] Repair TypeScript verification so a fresh checkout can actually typecheck.
  Evidence: `tsc --noEmit` fails on missing `.next/types/app/layout.ts`, `.next/types/app/page.ts`, and `.next/types/cache-life.d.ts`.
  Files: `tsconfig.json`
  Notes: stop hard-requiring stale generated files, or add a supported `next typegen` step before typecheck.

- [ ] Fix repo/worktree metadata so normal git operations work again.
  Evidence: `.git` currently points to `/home/luke/Desktop/homeschool-v2/.worktrees/codex-update-agents-worktree-guidance/.git/worktrees/homeschoolV2-main`, which does not resolve cleanly.
  Files: `.git`
  Notes: this blocks basic review and change-management workflows.

## P1 - Replace Demo Plumbing With Real App Plumbing

- [ ] Remove hard-coded demo household and learner IDs from route surfaces and resolve them from auth/session state.
  Evidence: `household-demo` and `learner-demo` are still wired directly into pages and APIs.
  Files: `app/(parent)/curriculum/page.tsx`, `app/(parent)/curriculum/new/page.tsx`, `app/(learner)/page.tsx`, `app/(learner)/activity/[sessionId]/page.tsx`, `app/api/curriculum/sources/route.ts`, `app/api/ai/chat/route.ts`

- [ ] Stop serving core product data from mock repositories when Drizzle repositories already exist.
  Evidence: curriculum, planning, tracking, and activity flows still import mock repositories or fixture stores even though `lib/db/repositories/*` exists.
  Files: `lib/curriculum/service.ts`, `lib/planning/service.ts`, `lib/tracking/service.ts`, `lib/activities/session-service.ts`, `lib/db/repositories/*.ts`
  Notes: right now the app looks data-modeled but behaves like an in-memory prototype.

- [ ] Put persistence behind activity attempts, copilot sessions, and reporting handoff.
  Evidence: `attempt-store` and `copilot-store` are in-memory singletons; `reportOutcome()` is still a stub.
  Files: `lib/activities/attempt-store.ts`, `lib/activities/session-service.ts`, `lib/ai/copilot-store.ts`
  Notes: attempts, chat history, and AI actions are lost on restart and never become durable reporting records.

- [ ] Add real route protection and auth-aware layout loading before adding more feature volume.
  Evidence: Supabase auth helpers exist, but no route guard, login flow, or session-backed loader is actually in use.
  Files: `lib/auth/server.ts`, `lib/auth/browser.ts`, `lib/platform/supabase.ts`, route files under `app/`

## P1 - Make AI Behavior Match What The UI Claims

- [ ] Unify runtime AI routing with displayed routing.
  Evidence: `app/(parent)/copilot/page.tsx` reads `getAiRoutingConfig()`, but `lib/ai/registry.ts` ignores it and always resolves adapters from `DEFAULT_ROUTING_CONFIG`.
  Files: `app/(parent)/copilot/page.tsx`, `lib/ai/routing.ts`, `lib/ai/registry.ts`, `lib/ai/provider-adapter.ts`, `lib/ai/task-service.ts`
  Notes: the UI can show one provider/model while the runtime still uses the mock adapter.

- [ ] Register a real provider adapter or hide provider/model badges until the runtime is real.
  Evidence: only the mock adapter is registered; comments still say "uncomment and implement when providers are ready."
  Files: `lib/ai/registry.ts`, `lib/ai/mock-adapter.ts`

- [ ] Fix the structured-output contract for standards suggestion.
  Evidence: `suggestStandardsWithAI()` calls `completeJson()`, but the mock `standards.suggest` response is markdown, not JSON, so it parses to `null` and returns `[]`.
  Files: `lib/ai/task-service.ts`, `lib/ai/mock-adapter.ts`, `lib/prompts/store.ts`

- [ ] Harden the chat streaming protocol and client parser.
  Evidence: `CopilotChat` splits raw chunks by newline without buffering partial SSE frames and swallows `event.error` inside a broad parse catch.
  Files: `components/copilot/CopilotChat.tsx`, `app/api/ai/chat/route.ts`
  Notes: stream errors are easy to lose and chunk boundaries are handled unsafely.

- [ ] Either implement copilot actions end-to-end or remove the dead UI for now.
  Evidence: `CopilotActionCard` and action state exist, but no response path ever populates actions.
  Files: `components/copilot/CopilotChat.tsx`, `components/copilot/CopilotActionCard.tsx`, `lib/ai/copilot-store.ts`, `lib/ai/types.ts`

- [ ] Finish the async generation pipeline or stop pretending jobs are running.
  Evidence: `/api/ai/generate` returns a job ID, but there is no job persistence, status endpoint, worker, or `api/inngest` route; `GenerateButton` gets stuck in a permanent "Generating..." state after dispatch.
  Files: `app/api/ai/generate/route.ts`, `components/copilot/GenerateButton.tsx`, `lib/ai/task-service.ts`, `lib/platform/config.ts`

## P2 - Finish Incomplete Product Flows

- [ ] Replace broken curriculum links with real routes or remove them.
  Evidence: the source detail page links to `/curriculum/[sourceId]/units/new`, but no such route exists.
  Files: `app/(parent)/curriculum/[sourceId]/page.tsx`, `app/`

- [ ] Finish standards mapping so selected standards can actually be attached to objectives.
  Evidence: the standards page only tracks local `selectedIds`; the CTA is disabled and there is no objective-selection flow.
  Files: `app/(parent)/curriculum/[sourceId]/standards/page.tsx`, `components/curriculum/StandardsBrowser.tsx`, curriculum service/repository files

- [ ] Replace the upload and AI-draft curriculum intake stubs with real storage and generation flows.
  Evidence: both paths in `AddSourceModal` are placeholder text only.
  Files: `components/curriculum/AddSourceModal.tsx`, `lib/storage/*`, `lib/curriculum/service.ts`

- [ ] Connect planning, today, and tracking views to live dates and live data.
  Evidence: `getTodayWorkspace()` defaults to a fixed `"2026-03-30"` and planning/tracking still read from mock snapshots.
  Files: `lib/planning/service.ts`, `lib/planning/mock-repository.ts`, `lib/tracking/service.ts`

- [ ] Decide whether learner surfaces live at `/`, under a dedicated learner prefix, or behind a separate entry flow.
  Evidence: learner pages, parent pages, and the landing page are all present, but the navigation/story for entering each mode is still unclear.
  Files: `app/page.tsx`, `app/(learner)/*`, `app/(parent)/*`, `components/navigation/global-page-tabs.tsx`

## P3 - Correctness And Cleanup

- [ ] Fix the `immediateFeeback` typo before this leaks into stored schemas or generated content.
  Files: `lib/activities/types.ts`, `lib/activities/fixtures.ts`

- [ ] Remove or replace stub-only logging once real integrations land.
  Evidence: curriculum indexing, AI generation dispatch, and activity outcome reporting all log placeholder messages instead of doing work.
  Files: `lib/curriculum/service.ts`, `lib/ai/task-service.ts`, `lib/activities/session-service.ts`

- [ ] Add automated verification for the app's critical paths.
  Minimum bar:
  - build succeeds in CI
  - typecheck works from a clean checkout
  - curriculum page renders
  - AI chat route streams valid SSE
  - activity attempt lifecycle persists and reports outcomes

## Suggested Order

1. Fix build, typecheck, and git/worktree hygiene.
2. Wire auth/session identity into routes and services.
3. Swap mock repositories for real DB-backed repositories on curriculum/planning/tracking/activities.
4. Finish AI runtime wiring so provider, routing, persistence, and job execution all agree.
5. Close the broken or stubbed curriculum/planning flows.
