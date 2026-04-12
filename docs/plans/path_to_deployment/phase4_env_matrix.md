# Phase 4: Environment Matrix

This file is the deployment source of truth for environment variables across `local`, `preview`, `staging`, and `production`.

Do not treat this as a secret store.
Use it to track:

- which env vars exist
- which environments require them
- where the real values live
- who owns setting them
- whether the value must be unique per environment

## Rules

- Never commit real secret values here.
- Use placeholders and notes only.
- `NEXT_PUBLIC_*` values are public by design and can be exposed to the browser.
- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `LEARNING_CORE_API_KEY`, `INNGEST_EVENT_KEY`, and `INNGEST_SIGNING_KEY` are secrets.
- Staging and production secrets must not be reused unless there is a clear reason.

## Current App Env Surface

| Variable | Local | Preview | Staging | Production | Secret | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `APP_ENV` | `local` | `hosted` | `hosted` | `hosted` | no | Current runtime only accepts `local` or `hosted`. Hosted environments should all use `hosted`. |
| `NEXT_PUBLIC_SITE_URL` | required | required | required | required | no | Must match the real public app URL for that environment. |
| `SUPABASE_PROJECT_REF` | required | optional | required | required | no | Use hosted project ref for staged and production Supabase projects. |
| `NEXT_PUBLIC_SUPABASE_URL` | required | required | required | required | no | Browser-safe project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required | required | required | required | no | Browser-safe publishable key. |
| `SUPABASE_SERVICE_ROLE_KEY` | required | optional | required | required | yes | Server-only key; never expose to the browser. |
| `DATABASE_URL` | required | optional | required | required | yes | Server-only direct DB connection string. |
| `LEARNING_CORE_BASE_URL` | optional locally, required for hosted integration | required if preview needs full AI integration | required | required | no | Points to the environment-specific `learning-core` service. |
| `LEARNING_CORE_API_KEY` | optional | required if `learning-core` is locked down | required | required | yes | Shared secret between app and `learning-core`. |
| `INNGEST_BASE_URL` | required by current env schema | required by current env schema | required by current env schema | required by current env schema | no | Currently configuration-only in this repo. |
| `INNGEST_EVENT_KEY` | required by current env schema | required by current env schema | required by current env schema | required by current env schema | yes | Current repo still validates this env even though the app route is not present. |
| `INNGEST_SIGNING_KEY` | required by current env schema | required by current env schema | required by current env schema | required by current env schema | yes | Same note as above. |

## Environment-Specific Notes

### Local

Expected sources:

- `.env.local`
- local Supabase CLI stack
- local `learning-core`
- hosted `learning-core` will default to Cloud Run in Phase 4

Known local defaults:

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### Preview

Current working rule:

- `stage` branch preview is the stable staging app URL
- Preview deploys use the staging Supabase project
- Preview deploys use the shared `learning-core` deployment for now
- Preview must never point at production Supabase resources

### Staging

Current hosted values known from provisioning:

- staging Supabase project ref: `ntlcjsnstxytxnfagyly`
- staging Supabase project URL: `https://ntlcjsnstxytxnfagyly.supabase.co`
- staging database host: `db.ntlcjsnstxytxnfagyly.supabase.co`

Still needed:

- one explicit hosted storage verification pass
- finalized rollback notes

### Production

Current hosted values known from provisioning:

- production Supabase project ref: `rqgiopliqeatdbgnbtnh`
- production Supabase project URL: `https://rqgiopliqeatdbgnbtnh.supabase.co`
- production database host: `db.rqgiopliqeatdbgnbtnh.supabase.co`

Still needed:

- one final production smoke verification after env changes settle
- finalized rollback notes

## Ownership Table

Fill this in during implementation.

| Variable Group | Owner | Where It Is Set | Last Verified |
| --- | --- | --- | --- |
| Public app URLs | Luke | Vercel project `prj_C9V6Mgxl4XhZiOAcsHEZhI7eY7YC` | 2026-04-11 |
| Hosted Supabase public values | Luke | Supabase projects + Vercel envs | 2026-04-11 |
| Hosted Supabase server secrets | Luke | Supabase dashboard + Vercel envs | 2026-04-11 |
| Hosted `learning-core` values | Luke | shared hosted deployment + Vercel envs | 2026-04-11 |
| Inngest values | Luke | Vercel | 2026-04-11 |

## Open Implementation Notes

- This repo currently validates Inngest env vars in all environments even though no `app/api/inngest` route exists yet.
- Local startup still runs Drizzle SQL migrations from `drizzle/*.sql`.
- Hosted startup does not read `drizzle/` from the filesystem, so staging and production schema changes must be applied before the Vercel app boots.
- A later deployment hardening pass may reduce the env surface or remove temporary requirements.
