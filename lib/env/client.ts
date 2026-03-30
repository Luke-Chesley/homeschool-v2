import { publicEnvSchema, formatEnvIssues } from "@/lib/env/shared";

export type ClientEnv = ReturnType<typeof getClientEnv>;

let cachedEnv: ReturnType<typeof publicEnvSchema.parse> | undefined;

export function getClientEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = publicEnvSchema.safeParse({
    APP_ENV: process.env.APP_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(`Invalid client environment:\n${formatEnvIssues(parsed.error.issues)}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
