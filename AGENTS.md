# Repository Guidelines

## Project Structure & Module Organization
- `/home/luke/Desktop/homeschool-v2` is the main checkout on `main`. This is the directory to use when you need the canonical repo root, the default dev server, or the merge target for branch worktrees.
- `app/` contains Next.js App Router pages, layouts, and API routes. Parent workspace routes live under `app/(parent)`, learner routes under `app/(learner)`.
- `components/` holds UI and feature components such as `components/planning`, `components/curriculum`, and `components/copilot`.
- `lib/` contains domain logic, mock repositories, environment parsing, DB schema/repositories, and AI integrations.
- `scripts/` contains local development helpers for Supabase, Inngest, and tool checks.
- `docs/` contains product, architecture, and implementation-plan documents.
- `supabase/` contains local Supabase configuration.
- `.worktrees/` holds auxiliary branch worktrees under this parent directory. Treat it as local workspace infrastructure, not product code.

## Build, Test, and Development Commands
- At the start of every session, check whether the main checkout is already serving on `http://localhost:3000`. If it is not running, start it from `/home/luke/Desktop/homeschool-v2` with `corepack pnpm dev` or `make dev` before browser-based validation.
- `corepack pnpm dev` or `make dev`: start the main checkout's Next.js dev server on `http://localhost:3000`.
- For any branch worktree under `.worktrees/`, never use `http://localhost:3000`; start Next.js on a unique alternate port such as `corepack pnpm dev -- --port 3001` and point browser tools at that port.
- `corepack pnpm build`: build the production app.
- `corepack pnpm start`: run the production build locally.
- `corepack pnpm typecheck`: run TypeScript checks; use this before finishing changes.
- `corepack pnpm dev:stack`: start local Supabase services.
- `corepack pnpm dev:stack:stop`: stop local Supabase services.
- `corepack pnpm inngest:dev`: run the local Inngest dev process when working on async jobs.

## Coding Style & Naming Conventions
- Use TypeScript with strict typing and 2-space indentation.
- Follow existing file naming: React components in `PascalCase.tsx`, utility/service modules in `kebab-case` or domain-oriented lowercase files.
- Prefer small, feature-local modules under `lib/<domain>` and `components/<domain>`.
- Keep Tailwind utility usage consistent with current patterns; shared primitives live in `components/ui`.

## Testing Guidelines
- There is no formal test suite yet; the minimum gate is `corepack pnpm typecheck`.
- Before opening browser tools or running UI checks, confirm whether the shared main server on `localhost:3000` is already available and reuse it when possible.
- When changing UI flows, verify the affected route in the browser and note the route tested, for example `/curriculum` or `/copilot`.
- Reserve `localhost:3000` for the main checkout at `/home/luke/Desktop/homeschool-v2`. If a worktree session needs browser validation, it must use its own port and report that exact URL, for example `http://localhost:3002/copilot`.
- For API or AI work, validate the relevant route locally, such as `app/api/ai/chat/route.ts`.

## Commit & Pull Request Guidelines
- Match the existing commit style: `feat(08): AI platform and copilot` for feature work and `coord: complete ...` for coordination/status commits.
- Use `/home/luke/Desktop/homeschool-v2` as the canonical `main` checkout. When work is ready to merge, merge it there. Do not rely on a separate `-main` directory.
- Before making code changes, create a dedicated `git worktree` from `main` and do your work there. Multiple agents may be working in parallel, so do not share a checkout when switching branches.
- Create branch worktrees under `.worktrees/`, for example `git worktree add ./.worktrees/<task-name> -b <branch-name> main`, then run all commands from that worktree path.
- Git only allows one worktree to have a branch checked out at a time. If `git switch main` fails because `main` is already checked out at `/home/luke/Desktop/homeschool-v2`, that is expected; use the main checkout directory instead of switching another worktree to `main`.
- Treat `/home/luke/Desktop/homeschool-v2` as the only checkout allowed to own the default localhost session. Any branch worktree that needs a dev server or browser automation must choose a different port so it does not take over the user's main browser view.
- Useful checks: `git worktree list` shows which directory owns each branch, and `git branch --show-current` confirms which branch the current directory is on.
- When your work is complete, merge your branch back into `main`, resolve any conflicts, and remove the temporary worktree if it is no longer needed, for example `git worktree remove ./.worktrees/<task-name>`.
- Keep commits focused by feature or plan slice.
- PRs should include a short description, affected routes/modules, verification steps, and screenshots for UI changes.

## Security & Configuration Tips
- Store secrets only in `.env.local`; never commit credentials.
- Keep `.env.example` updated when adding required configuration such as AI provider or model settings.
