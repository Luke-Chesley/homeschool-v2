import { getServerEnv } from "@/lib/env/server";

export type PlatformConfig = ReturnType<typeof getPlatformConfig>;

export function getPlatformConfig() {
  const env = getServerEnv();
  const isLocal = env.APP_ENV === "local";

  return {
    appEnv: env.APP_ENV,
    isLocal,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    supabase: {
      projectRef: env.SUPABASE_PROJECT_REF,
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      localStudioUrl: isLocal ? "http://127.0.0.1:54323" : null,
      localInbucketUrl: isLocal ? "http://127.0.0.1:54324" : null,
      databaseUrl: env.DATABASE_URL,
    },
    inngest: {
      baseUrl: env.INNGEST_BASE_URL,
      servePath: "/api/inngest",
      eventKey: env.INNGEST_EVENT_KEY,
      signingKey: env.INNGEST_SIGNING_KEY,
    },
  };
}
