# Studio Mode Agent Handoff

## Mission

Implement Phase 1 of the deployment path: a local-first `studio mode` foundation for `homeschool-v2`.

This task is not the full redesign.
This task is not production auth hardening.
This task is not hosted deployment setup.

The goal is to preserve existing debug and operator visibility while removing inline debug UI from the default product experience.

## Source Of Truth

Start here:

- [Path To Deployment README](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/README.md)
- [Studio Mode Implementation Checklist](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/studio-mode-implementation-checklist.md)
- [Deployment Studio Roadmap](/home/luke/Desktop/learning/homeschool-v2/docs/plans/path_to_deployment/deployment-studio-roadmap.md)

## Scope

Do only Phase 1: `Studio Mode Foundation`.

### In Scope

- local-first studio access model
- server-side studio access resolution
- studio client context/provider
- reusable studio UI primitives
- quiet studio toggle placement in current shell
- move lesson draft debug/prompt preview out of the default flow
- add shared trace metadata UI
- set up the pattern for reuse in other AI/debug surfaces

### Out Of Scope

- full shell redesign
- auth rewrite
- RLS or storage policy implementation
- Vercel or hosted Supabase setup
- mobile redesign
- broad product copy/design pass
- new repo creation

## Worktree And Branch

Create a dedicated worktree and branch from `main`.

Recommended:

```bash
git worktree add ./.worktrees/studio-mode-foundation -b feat/studio-mode-foundation main
cd ./.worktrees/studio-mode-foundation
```

Run local dev on a non-3000 port from the worktree.

Recommended:

```bash
corepack pnpm dev -- --port 3001
```

Use `http://127.0.0.1:3001` for browser validation from the worktree.

## Owned Write Areas

Primary owned scope:

- `docs/plans/path_to_deployment/**`
- `lib/**` only where needed for studio access/context helpers
- `components/studio/**` if you create a dedicated studio component area
- `components/ui/**` only for generic reusable studio-friendly primitives if necessary
- `components/parent-shell/**` only enough to place the studio toggle
- `components/planning/**` only enough to move debug UI out of the default flow
- `components/debug/**` if you need to reuse or reshape existing debug views
- `app/(parent)/**` only enough to thread studio access state into the shell or page surface

## Avoid Editing

Do not expand scope into these areas unless absolutely necessary:

- `lib/db/schema/**`
- `drizzle/**`
- `supabase/**`
- auth routes and login flows
- learner route behavior outside debug-panel wiring
- major navigation model changes
- full visual redesign of shell/page layouts

## Existing Files To Read First

Read these before changing anything:

- [components/planning/lesson-plan-panel.tsx](/home/luke/Desktop/learning/homeschool-v2/components/planning/lesson-plan-panel.tsx)
- [components/debug/LearningCorePromptPreviewCard.tsx](/home/luke/Desktop/learning/homeschool-v2/components/debug/LearningCorePromptPreviewCard.tsx)
- [components/parent-shell/parent-shell.tsx](/home/luke/Desktop/learning/homeschool-v2/components/parent-shell/parent-shell.tsx)
- [components/parent-shell/parent-topbar.tsx](/home/luke/Desktop/learning/homeschool-v2/components/parent-shell/parent-topbar.tsx)
- [app/(parent)/layout.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/layout.tsx>)
- [components/planning/today-workspace-view.tsx](/home/luke/Desktop/learning/homeschool-v2/components/planning/today-workspace-view.tsx)
- [app/globals.css](/home/luke/Desktop/learning/homeschool-v2/app/globals.css)

## Recommended Implementation Order

### Step 1: Define Studio Access Shape

Create a small typed access model.

Target idea:

- `enabled`
- `isLocal`
- `isOperator`
- `canViewPrompts`
- `canViewArtifacts`
- `canViewRuntimeEvents`

Implementation guidance:

- keep this server-first
- local dev can return enabled access without waiting for auth hardening
- non-local can default to disabled for now

Suggested location:

- `lib/studio/access.ts`
- optionally `lib/studio/types.ts`

### Step 2: Add Studio Provider And Toggle State

Create a client provider for UI state only.

Expected responsibilities:

- read the server-resolved access state
- expose whether studio controls should render
- track whether a panel/drawer is open
- support future extension without becoming a giant global state system

Suggested location:

- `components/studio/studio-provider.tsx`
- `components/studio/use-studio.ts`

### Step 3: Build Studio Primitives

Create reusable primitives instead of one-off debug blocks.

Minimum set:

- `StudioToggle`
- `StudioPanel`
- `StudioDrawer` or `StudioSheet`
- `StudioSection`
- `StudioJsonInspector`
- `StudioTraceMeta`

Design direction:

- quiet
- compact
- secondary to the product content
- consistent with the repo’s muted serif/sans visual language

Suggested location:

- `components/studio/*`

### Step 4: Thread Studio Access Through Parent Shell

Wire the server-resolved access into the parent shell.

Requirements:

- studio toggle visible only when access is enabled
- placement should be quiet and temporary, not a major shell redesign
- current shell structure should remain intact for this task

Suggested touch points:

- `app/(parent)/layout.tsx`
- `components/parent-shell/parent-shell.tsx`
- `components/parent-shell/parent-topbar.tsx`

### Step 5: Convert Lesson Draft Debug Flow First

This is the first required migration.

Current problem:

- prompt preview/debug surfaces are too close to the primary lesson flow

Required result:

- product mode: calm lesson surface with no inline debug payloads
- studio mode: prompt/debug info available one interaction away

Suggested touch points:

- `components/planning/lesson-plan-panel.tsx`
- `components/debug/LearningCorePromptPreviewCard.tsx`
- `components/planning/today-workspace-view.tsx`

Preserve all existing useful data:

- operation name
- request ID
- skill name/version
- allowed tools
- system prompt
- user prompt
- request envelope

### Step 6: Add Shared Trace Metadata Component

Build a shared trace meta block that can later be reused by:

- lesson generation
- curriculum AI flows
- copilot
- learner runtime transition debug

Suggested fields:

- request ID
- operation name
- artifact/session ID when present
- timestamp when present

Suggested location:

- `components/studio/StudioTraceMeta.tsx`

### Step 7: Prepare Reuse For Other AI Surfaces

Do not fully convert every surface in this task if it causes scope drift.

But leave behind:

- reusable primitives
- a clear access model
- at least one good reference implementation

If time permits, lightly apply the same pattern to one additional AI/debug surface after lesson draft.

Recommended second target:

- curriculum AI flow or copilot debug

## Acceptance Criteria

The task is complete when all of the following are true:

- a local developer can enable studio mode without external service setup
- studio access is resolved server-side
- studio UI state is handled separately from authorization
- a quiet studio toggle exists in the current shell
- lesson draft debug info is no longer inline in the default product reading flow
- prompt/debug info is still easy to inspect in studio mode
- the new pattern is reusable for future AI/debug surfaces

## Verification

Minimum verification:

```bash
corepack pnpm typecheck
```

Also verify in the browser from the worktree server:

- parent shell loads with studio mode hidden when disabled
- studio toggle appears when access is enabled
- lesson draft flow still works
- prompt preview and debug info are accessible in studio mode
- product flow remains readable without studio panels open

Suggested routes to check:

- `/today`
- `/planning`
- any route where lesson draft generation/debug is currently exposed

## Deliverable Summary For PR Or Handoff

When reporting back, include:

- what files were added for studio infrastructure
- where studio access is resolved
- where the studio toggle was placed
- how lesson draft debug was moved out of the main flow
- what remains for later phases

## One-Sentence Assignment

Implement a local-first studio mode foundation in `homeschool-v2`, with reusable studio primitives and server-side access gating, and move the lesson draft debug flow out of the default product UI without starting the broader redesign.
