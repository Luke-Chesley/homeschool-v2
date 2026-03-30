import "server-only";

import { z } from "zod";

import { formatEnvIssues, publicEnvSchema } from "@/lib/env/shared";

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_PROJECT_REF: z.string().min(1).default("local"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  INNGEST_BASE_URL: z.string().url().default("http://127.0.0.1:8288"),
  INNGEST_EVENT_KEY: z.string().min(1),
  INNGEST_SIGNING_KEY: z.string().min(1),
});

export type ServerEnv = ReturnType<typeof getServerEnv>;

let cachedEnv: ReturnType<typeof serverEnvSchema.parse> | undefined;

export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid server environment:\n${formatEnvIssues(parsed.error.issues)}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
