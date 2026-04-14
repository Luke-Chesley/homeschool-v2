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
- For feature work that needs review, prefer keeping the change on its branch worktree server first and share that alternate URL for approval before merging anything back to `main`.
- `corepack pnpm build`: build the production app.
- `corepack pnpm start`: run the production build locally.
- `corepack pnpm typecheck`: run TypeScript checks; use this before finishing changes.
- `bash ./scripts/verify-before-merge.sh`: run typecheck plus a browser smoke test against the live dev server; use this after merging a branch back to `main` before declaring the work complete.
- `corepack pnpm dev:stack`: start local Supabase services.
- `corepack pnpm dev:stack:stop`: stop local Supabase services.
- `corepack pnpm inngest:dev`: run the local Inngest dev process when working on async jobs.

## Coding Style & Naming Conventions
- Use TypeScript with strict typing and 2-space indentation.
- Follow existing file naming: React components in `PascalCase.tsx`, utility/service modules in `kebab-case` or domain-oriented lowercase files.
- Prefer small, feature-local modules under `lib/<domain>` and `components/<domain>`.
- Keep Tailwind utility usage consistent with current patterns; shared primitives live in `components/ui`.

## Frontend Design Guardrails
- Default to a daily-first interaction model. `Today` is the operational center of the app, and planning, curriculum, tracking, and copilot should feel like supporting workspaces around that center rather than separate products with their own heavy intros.
- Keep parent chrome quiet. Use the existing fixed left workspace rail plus a compact top bar. Do not reintroduce floating sidebars, oversized shells, large hero headers, or repeated explanatory headers on every page.
- Keep learner surfaces even simpler than parent surfaces. The learner home should read like a clean daily queue with obvious next actions, not a dashboard or a management screen.
- Cut copy aggressively. Interface text should help the user choose, act, or recover. Remove decorative descriptions, repeated summaries, “what this screen does” paragraphs, and redundant labels.
- Prefer direct labels over clever labels. Route names like `Today`, `Planning`, `Curriculum`, `Tracking`, and `Copilot` are the model. Avoid ornamental product copy inside the app.
- Keep navigation shallow and stable. Users should be able to move between `Today`, `Planning`, `Curriculum`, `Tracking`, and `Copilot` without mode confusion or nested navigation stacks.
- Use cards sparingly and make them plain. Prefer small radii, light borders, quiet backgrounds, and restrained shadows. Do not bring back glassmorphism, giant rounded corners, glow effects, gradient shells, or “premium dashboard” styling.
- Keep actions obvious and local. A surface should expose the next relevant action near the content it affects instead of introducing separate “insight,” “summary,” or “control” panels.
- Prefer one compact control over many repeated controls. Example: use a single state select when that is clearer than several state buttons repeated for every row.
- Treat AI as embedded assistance, not as the main visual identity. Copilot should be chat-first, contextual, and quiet. Avoid hype-heavy AI framing, oversized AI panels, or extra explanatory scaffolding.
- Preserve the current token-driven visual tone in `app/globals.css` and `components/ui/*`: smaller radii, flatter surfaces, simple borders, and minimal motion. Changes to shared primitives should be deliberate because they affect the whole app.
- Avoid dashboard filler. Do not add KPI grids, fake charts, trend cards, “insight” badges, decorative status pills, or right-rail summary panels unless they serve a real workflow need.
- Internal pages should not use landing-page composition. No hero sections, no marketing-style blocks, and no oversized narrative panels inside the parent or learner app.
- When editing or adding a page, optimize first for scanability on laptop width. The page should read cleanly in a quick vertical pass with a small number of visual layers and a clear primary task.
- For new UI work, check the existing `Today`, `Planning`, `Curriculum`, learner, and `Copilot` pages first and extend those patterns before inventing new layout languages.

## Testing Guidelines
- For every new or updated user flow, update the QA documentation in the same task with robust click-through coverage: include step-by-step navigation instructions agents can execute, expected outcomes on each page, and explicit reporting notes for what passed, failed, or looked suspicious.
- There is no formal test suite yet; the minimum gate is `corepack pnpm typecheck`, and UI changes should also run `bash ./scripts/verify-before-merge.sh` before merge completion.
- Before opening browser tools or running UI checks, confirm whether the shared main server on `localhost:3000` is already available and reuse it when possible.
- When changing UI flows, verify the affected route in the browser and note the route tested, for example `/curriculum` or `/copilot`.
- Reserve `localhost:3000` for the main checkout at `/home/luke/Desktop/homeschool-v2`. If a worktree session needs browser validation, it must use its own port and report that exact URL, for example `http://localhost:3002/copilot`.
- For API or AI work, validate the relevant route locally, such as `app/api/ai/chat/route.ts`.

## Commit & Pull Request Guidelines
- Match the existing commit style: `feat(08): AI platform and copilot` for feature work and `coord: complete ...` for coordination/status commits.
- Use `/home/luke/Desktop/homeschool-v2` as the canonical `main` checkout. When work is ready to merge, merge it there. Do not rely on a separate `-main` directory.
- Before making code changes, create a dedicated `git worktree` from `main` and do your work there. Multiple agents may be working in parallel, so do not share a checkout when switching branches.
- Create branch worktrees under `.worktrees/`, for example `git worktree add ./.worktrees/<task-name> -b <branch-name> main`, then run all commands from that worktree path.
- For new feature work, default to this review flow: create a fresh worktree, run that branch on its own non-`3000` port, let the user review the branch URL, and keep the branch isolated until the user explicitly approves merging to `main`.
- Git only allows one worktree to have a branch checked out at a time. If `git switch main` fails because `main` is already checked out at `/home/luke/Desktop/homeschool-v2`, that is expected; use the main checkout directory instead of switching another worktree to `main`.
- Treat `/home/luke/Desktop/homeschool-v2` as the only checkout allowed to own the default localhost session. Any branch worktree that needs a dev server or browser automation must choose a different port so it does not take over the user's main browser view.
- Useful checks: `git worktree list` shows which directory owns each branch, and `git branch --show-current` confirms which branch the current directory is on.
- Merges into `stage` are pre-approved and do not require an extra permission check. Use `stage` as the staging integration branch when you need to push a fix for preview deployment or hosted verification.
- Do not merge a feature branch back into `main` automatically. Merge only after the user has reviewed the branch build and explicitly approved the merge.
- Once a merge is explicitly approved and completed, remove the temporary worktree if it is no longer needed, for example `git worktree remove ./.worktrees/<task-name>`.
- Keep commits focused by feature or plan slice.
- PRs should include a short description, affected routes/modules, verification steps, and screenshots for UI changes.

## Security & Configuration Tips
- Store secrets only in `.env.local`; never commit credentials.
- Keep `.env.example` updated when adding required configuration such as AI provider or model settings.

## Contract Maintenance
- This repository uses a first-class contract registry in `/contracts/` to track the shape and requirements of generated artifacts (curriculum, lesson drafts, activities).
- If a task changes the shape, required fields, defaults, versioning, persistence, ownership hierarchy, or consumer expectations of a generated artifact, you **must** update the matching file in `/contracts/` in the same change.
- If no contract file exists yet for a new generated artifact, create one using `contracts/_template.md`.
- If a contract file changes, update `contracts/contract-index.json`.
- Run `npm run contracts:check` to ensure the registry remains structurally sound before finishing your task.

## Documentation Maintenance
- Keep `README.md` current when the repo structure, key control points, setup flow, or major feature surfaces change.
- If you add, remove, or significantly reorganize top-level directories or major subsystems, update `README.md` in the same task unless the user explicitly says not to.
