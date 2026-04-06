# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make install              # Install dependencies (pnpm via corepack)
make dev                  # Start dev server on localhost:3000
make dev-stack            # Start local Supabase services
make stop-stack           # Stop local Supabase services
make reset-db             # Reset local DB via Supabase
make inngest              # Run local Inngest dev process
make typecheck            # tsc --noEmit
pnpm build                # Production build
pnpm lint                 # ESLint via Next.js
pnpm test:curriculum      # Run curriculum unit tests (Node test runner)
bash ./scripts/verify-before-merge.sh  # typecheck + browser smoke test (run after merging to main)
```

Environment: copy `.env.example` to `.env.local` and fill in Supabase, DB, AI provider, and Inngest keys.

## Architecture

**Stack**: Next.js 15 App Router + React 19 + TypeScript (strict) + Tailwind v4 + Supabase (auth + Postgres) + Drizzle ORM + Inngest (background jobs) + Zod

**Layer boundaries**:
- `app/` — routes, layouts, server actions, page loaders only
  - `app/(parent)/` — parent workspace routes: `today`, `planning`, `curriculum`, `tracking`, `copilot`
  - `app/(learner)/` — learner-facing routes
- `components/` — UI primitives (`components/ui/`) and product feature components
- `lib/` — auth, database clients, domain logic, AI orchestration, planning/scheduling

**Key conventions**:
- AI work runs via Inngest background jobs, never blocking request handlers
- Supabase for auth (no custom username/password)
- Drizzle ORM for all DB access; schema in `lib/db/schema/`, per-domain repositories in `lib/db/repositories/`
- AI provider system is multi-adapter (`lib/ai/`): Anthropic, Ollama, and mock adapters behind a provider-agnostic interface (`provider-adapter.ts`); model routing via `routing.ts`
- `cn()` from `lib/utils.ts` for class merging (clsx + tailwind-merge)
- UI components use `class-variance-authority` (CVA) for variants
- Path alias `@/*` maps to the project root

**Core domain objects**: Organization (multi-tenant workspace), Learner, Curriculum, Plan, Schedule, Lesson, Worksheet, Progress — each has one source-of-truth owner in `lib/`.

**Current phase**: Foundation/scaffold. Auth, data model, and AI job boundaries must be stable before adding product features (see `docs/ROADMAP.md`).

## Worktree Workflow

Feature work should be done in a git worktree, not directly on `main`:

```bash
git worktree add ./.worktrees/<task-name> -b <branch-name> main
```

- `main` checkout at `/home/luke/Desktop/homeschool-v2` owns `localhost:3000`
- Worktree dev servers must use alternate ports (`pnpm dev -- --port 3001`)
- Never merge a feature branch to `main` without explicit user approval
- After merge: `git worktree remove ./.worktrees/<task-name>`
- Check state with `git worktree list`

## Frontend Design Guardrails

- **Daily-first**: `Today` is the operational center; Planning, Curriculum, Tracking, Copilot are supporting workspaces
- **Quiet chrome**: fixed left rail + compact top bar only — no floating sidebars, hero headers, or oversized shells
- **Learner surfaces** must be simpler than parent surfaces — a clean daily queue, not a dashboard
- **Cut copy**: no decorative descriptions, repeated summaries, or "what this screen does" paragraphs
- **Plain cards**: small radii, light borders, quiet backgrounds — no glassmorphism, glow effects, or gradient shells
- **No dashboard filler**: no KPI grids, fake charts, trend cards, or decorative status pills unless serving a real workflow
- **AI is embedded assistance**, not the main visual identity — Copilot should be chat-first and quiet
- Preserve the token-driven visual tone in `app/globals.css` and `components/ui/*`; changes to shared primitives affect the whole app
- Before adding new layout patterns, check existing `Today`, `Planning`, `Curriculum`, and `Copilot` pages first

## Commit Style

Match existing style: `feat(scope): description` for features, `fix(scope): description` for fixes, `coord: complete ...` for coordination commits.

## Documentation

The `docs/` directory contains authoritative product and architecture decisions — read these before implementing new features:
- `docs/ARCHITECTURE.md` — tech rationale, system boundaries, initial DB table design
- `docs/VISION.md` — user personas, core objects, MVP vs non-MVP scope
- `docs/PRODUCT_IMPLEMENTATION_PLAN.md` — full use-case spec, data flows, parallel workstreams
- `docs/ROADMAP.md` — 5-phase delivery plan
- `docs/MIGRATION_NOTES.md` — what carries over from V1 (curriculum hierarchy, scheduling logic)
