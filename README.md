# Homeschool V2

Homeschool V2 is a fresh restart of the product with a tighter stack and cleaner boundaries than the original repo.

## What This Repo Is

- Next.js app for product UI and server-side logic
- TypeScript-first
- designed for hosted Postgres and managed auth
- structured for AI-assisted development with clear docs and narrow modules

## Why V2 Exists

The original repo proved out useful ideas:

- curriculum hierarchy
- daily schedule generation
- parent/teacher preferences
- AI lesson plans
- AI worksheets
- calendar-style planning

But it also accumulated prototype drag:

- split Django + CRA setup
- mixed auth patterns
- checked-in SQLite state
- fallback users in production code
- synchronous AI work in request handlers
- unclear local setup

This repo keeps the good ideas and drops the accidental complexity.

## Proposed Stack

- Next.js 15
- React 19
- TypeScript
- Supabase for Postgres, Auth, and Storage
- Drizzle ORM for typed schema and migrations
- Inngest for background AI jobs
- Vercel for app hosting

## Product Direction

Core product surface for V2:

1. Parent signs up and creates a learner profile
2. Parent imports or builds curriculum
3. App generates a flexible daily/weekly plan
4. Parent opens a single daily workspace
5. AI helps draft lesson plans, worksheets, and adaptations
6. Parent tracks progress and adjusts future plans

## Repo Docs

- [Vision](./docs/VISION.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Migration Notes](./docs/MIGRATION_NOTES.md)

## Local Setup

1. Install dependencies

```bash
make install
```

2. Copy env file

```bash
cp .env.example .env.local
```

3. Fill in required keys

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

4. Run the app

```bash
make dev
```

## UI Stack

- Tailwind CSS v4 for layout, spacing, responsive states, and design tokens
- `shadcn/ui`-style local components in `components/ui`
- Minimal global CSS in `app/globals.css`

This setup keeps the UI fast to iterate on without locking the project into a heavy component framework or a large handwritten stylesheet.

## Initial Rule For Development

Do not add product features until auth, data model, and AI job boundaries are stable.
