# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make install        # Install dependencies (pnpm via corepack)
make dev            # Start dev server (pnpm dev)
pnpm build          # Production build
pnpm lint           # ESLint via Next.js
pnpm typecheck      # tsc --noEmit
```

Environment: copy `.env.example` to `.env.local` and fill in Supabase, DB, AI provider, and Inngest keys.

## Architecture

**Stack**: Next.js 15 App Router + React 19 + TypeScript (strict) + Tailwind v4 + Supabase (auth + Postgres) + Drizzle ORM + Inngest (background jobs) + Zod

**Layer boundaries**:
- `app/` — routes, layouts, server actions, page loaders only
- `components/` — UI primitives (`components/ui/`) and product feature components
- `lib/` — auth, database clients, domain logic, AI orchestration, planning/scheduling

**Key conventions**:
- AI work runs via Inngest background jobs, never blocking request handlers
- Supabase for auth (no custom username/password)
- Drizzle ORM for all DB access (type-safe, schema-driven)
- `cn()` from `lib/utils.ts` for class merging (clsx + tailwind-merge)
- UI components use `class-variance-authority` (CVA) for variants
- Path alias `@/*` maps to the project root

**Core domain objects**: Organization (multi-tenant workspace), Learner, Curriculum, Plan, Schedule, Lesson, Worksheet, Progress — each has one source-of-truth owner in `lib/`.

**Current phase**: Foundation/scaffold. Auth, data model, and AI job boundaries must be stable before adding product features (see `docs/ROADMAP.md`).

## Documentation

The `docs/` directory contains authoritative product and architecture decisions — read these before implementing new features:
- `docs/ARCHITECTURE.md` — tech rationale, system boundaries, initial DB table design
- `docs/VISION.md` — user personas, core objects, MVP vs non-MVP scope
- `docs/PRODUCT_IMPLEMENTATION_PLAN.md` — full use-case spec, data flows, parallel workstreams
- `docs/ROADMAP.md` — 5-phase delivery plan
- `docs/MIGRATION_NOTES.md` — what carries over from V1 (curriculum hierarchy, scheduling logic)
