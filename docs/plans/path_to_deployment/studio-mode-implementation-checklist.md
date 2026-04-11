# Studio Mode Implementation Checklist

## Purpose

This checklist is for implementing `studio mode` in `homeschool-v2` without blocking on hosted deployment work.

The goal is to preserve all useful debug and operator visibility while removing that debug weight from the default product UX.

## Answer First: External Service Setup

For this phase, external hosted setup is not required.

You can complete the first pass of studio mode entirely in local development using the current local app setup.

### What Can Stay Local

- studio access model and gating helpers
- studio UI primitives
- studio toggle and context
- moving current inline debug surfaces into studio panels
- local-only studio access rules
- trace IDs and debug metadata already returned by app and `learning-core`

### What Is Optional During This Phase

- DB-backed studio permissions
- hosted Supabase project setup
- Vercel setup
- production-safe admin/operator permissions
- staging environment validation

### What Will Eventually Need External Setup

- production operator access rules
- hosted auth and org membership checks
- staging verification for studio access in a hosted environment
- production monitoring links and trace workflows

## Scope

Implement the `studio mode` foundation only.

Do not redesign the full app shell yet.
Do not implement production auth/RLS yet unless required by a specific checklist item.
Do not introduce a separate studio app or separate repo.

## Success Criteria

- product pages still work with studio mode fully disabled
- debug info is easy to open for approved users in local development
- lesson-plan prompt previews are no longer inline in the default product flow
- the pattern is reusable for copilot, curriculum AI, and learner runtime debug panels
- no route depends on studio mode for its primary UX

## Working Model

`product mode`
- default mode
- quiet UI
- no inline prompt dumps or raw JSON blocks in the main flow

`studio mode`
- additive operator layer
- visible in local dev by default
- exposed through drawers, inspectors, collapsible panels, or overlays

## Implementation Checklist

### 1. Define Studio Access Rules

- Create a written rule set for who gets studio mode in local dev.
- Default local behavior: enabled for the developer session.
- Default non-local behavior for now: disabled unless explicitly enabled by server-side logic.
- Do not rely only on a client-side env var for permission.

### 2. Add Server-Side Studio Resolution

Create a small server-side utility layer with functions like:

- `isLocalStudioEnabled()`
- `getStudioAccess()`
- `canViewPromptPreviews()`
- `canViewRawArtifacts()`

Requirements:

- server-first
- no client trust for authorization
- local development should work even before full auth hardening
- return a stable shape that route layouts and components can consume

Suggested outputs:

- `enabled`
- `isLocal`
- `isOperator`
- `canViewPrompts`
- `canViewArtifacts`
- `canViewRuntimeEvents`

### 3. Add Studio Context For UI Consumption

Add a lightweight client context/provider for UI composition.

Requirements:

- receives resolved server access state
- controls whether studio controls are shown
- tracks panel open/closed state
- supports future URL-based panel state if needed

Keep it small. Do not put authorization logic in the client context.

### 4. Build Studio UI Primitives

Implement reusable primitives instead of custom debug panels on each screen.

Required primitives:

- `StudioToggle`
- `StudioPanel`
- `StudioDrawer` or `StudioSheet`
- `StudioSection`
- `StudioJsonInspector`
- `StudioTraceMeta`

Requirements:

- calm visual language
- additive and collapsible
- does not dominate page hierarchy
- safe to render nothing when studio access is false

### 5. Choose Studio Toggle Placement

Implement one temporary placement now.

Recommended first pass:

- place the toggle in existing parent chrome for local/dev users only
- keep the control visually quiet
- do not make it a large persistent badge or debug banner

Do not redesign the full shell here. Just provide a stable location that can survive later refactors.

### 6. Move Lesson Draft Debug Out Of Main Flow

First conversion target:

- lesson draft prompt preview
- learning-core prompt preview cards
- related raw debug output in planning/today flow

Tasks:

- remove inline debug blocks from the product reading surface
- expose them through studio-only panel(s)
- preserve all existing information, especially:
  - operation name
  - request ID
  - skill/version
  - allowed tools
  - system prompt
  - user prompt
  - request envelope

Result:

- in product mode, the lesson flow is quiet
- in studio mode, the same information is one interaction away

### 7. Add A Shared Trace Metadata Pattern

Create a compact reusable trace metadata display.

Minimum fields:

- request ID
- operation name
- timestamp when available
- artifact/session ID when available

This must be easy to reuse in:

- lesson generation
- curriculum AI flows
- copilot
- learner runtime transitions

### 8. Add Studio Wrappers To AI Surfaces

After lesson draft panels work, extend the same pattern to:

- curriculum AI draft/refine flows
- copilot debug views
- learner activity transition/feedback diagnostics

Do not redesign those surfaces yet. Only move debug concerns into the new studio layer.

### 9. Add Local Documentation

Update docs to explain:

- what studio mode is
- who can use it in local development
- where the toggle appears
- how to add new studio panels
- what should never appear inline in product mode again

### 10. Verify The Split

Test all of the following locally:

- studio mode off: product flow remains clean
- studio mode on: prompt/debug info is available
- no missing core actions when studio mode is off
- lesson draft generation still works
- existing debug content is not lost, only relocated

## Suggested File Ownership

This work will likely touch:

- `lib/` for studio access resolution
- `components/ui/` or a new `components/studio/` area for primitives
- parent shell/navigation files only enough to place the toggle
- planning/today debug components for first migration
- relevant AI/debug components that currently render inline

## Avoid During This Task

- full shell redesign
- auth rewrite
- RLS implementation
- hosted deployment setup
- mobile redesign
- contract/schema changes unless absolutely necessary for trace metadata

## Handoff Notes For Another Agent

If you are assigning this to another agent, give them this exact goal:

"Implement a local-first studio mode in `homeschool-v2` that preserves existing prompt/debug visibility while removing inline debug UI from the default product experience. Build reusable studio primitives and convert the lesson draft debug flow first. Do not redesign the whole shell yet. Do not require hosted setup for the first pass."

## Recommended Next Task After Completion

After this checklist is done, the next task should be:

- production auth and workspace hardening

That is the point where external hosted setup starts to matter more.
