# Architecture

> Status: historical stack and repo-shape note from before the current strict `learning-core` boundary.
> For the current operational product/runtime model, use [CURRENT_PRODUCT_AND_RUNTIME_MODEL.md](./CURRENT_PRODUCT_AND_RUNTIME_MODEL.md).

## High-Level Choice

V2 should be a single Next.js application, not a split Django + CRA repo.

Reasons:

- one routing model
- one auth integration path
- one deployment target for the core app
- easier AI-assisted development because the codebase has fewer seams

## Recommended Stack

- App framework: Next.js App Router
- Language: TypeScript
- Database: Postgres
- Auth: Supabase Auth
- ORM: Drizzle
- Background jobs: Inngest
- AI providers: OpenAI and/or Anthropic behind a small provider abstraction
- Hosting: Vercel for web, Supabase for data

## System Boundaries

`app/`

- routes
- layouts
- server actions
- page-level loaders

`components/`

- reusable UI primitives
- product-specific feature components

`lib/`

- auth
- database
- curriculum domain logic
- planning/scheduling logic
- AI job orchestration

`docs/`

- product decisions
- architecture
- migration notes

## Auth Direction

Use managed auth. Do not build custom username/password flows unless product requirements force it.

For this product, auth should provide:

- email magic link or password login
- secure server-side session handling
- easy route protection
- user metadata

## Data Direction

Use Postgres from day one.

Avoid:

- SQLite as the long-term source of truth
- checked-in stateful DB files
- app logic that depends on anonymous fallback users

## AI Direction

AI generation should be job-based.

Good pattern:

1. user requests lesson or worksheet generation
2. app creates a generation record
3. background job runs prompt + model call
4. result is stored as a versioned artifact
5. UI polls or streams status

Avoid:

- blocking page loads on model latency
- burying prompts directly in route handlers
- storing only the final text with no source metadata

## Deployment Direction

Production shape:

- Vercel hosts the Next.js app
- Supabase hosts Postgres/Auth/Storage
- Inngest handles async jobs

This is materially simpler than separately hosting:

- React dev server
- Django app server
- SQLite file state

## Suggested Initial Tables

- users
- households
- household_members
- learners
- curriculum_sources
- curriculum_items
- plans
- plan_days
- plan_items
- generated_artifacts
- progress_records
- events

## First Engineering Rule

Every domain concept should have one obvious home and one obvious source of truth.
