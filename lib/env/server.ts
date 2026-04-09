import "@/lib/server-only";

import { z } from "zod";

import { formatEnvIssues, publicEnvSchema } from "@/lib/env/shared";

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(1).optional());

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_PROJECT_REF: z.string().min(1).default("local"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  LEARNING_CORE_BASE_URL: optionalNonEmptyString,
  LEARNING_CORE_API_KEY: optionalNonEmptyString,
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

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

let cachedDatabaseEnv: z.infer<typeof databaseEnvSchema> | undefined;

export function getDatabaseEnv() {
  if (cachedDatabaseEnv) {
    return cachedDatabaseEnv;
  }

  const parsed = databaseEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
  });

  if (!parsed.success) {
    throw new Error(`Invalid database environment:\n${formatEnvIssues(parsed.error.issues)}`);
  }

  cachedDatabaseEnv = parsed.data;
  return cachedDatabaseEnv;
}

const learningCoreEnvSchema = z.object({
  LEARNING_CORE_BASE_URL: z.string().trim().min(1),
  LEARNING_CORE_API_KEY: optionalNonEmptyString,
});

let cachedLearningCoreEnv: z.infer<typeof learningCoreEnvSchema> | undefined;

export function getLearningCoreEnv() {
  if (cachedLearningCoreEnv) {
    return cachedLearningCoreEnv;
  }

  const parsed = learningCoreEnvSchema.safeParse({
    LEARNING_CORE_BASE_URL: process.env.LEARNING_CORE_BASE_URL,
    LEARNING_CORE_API_KEY: process.env.LEARNING_CORE_API_KEY,
  });

  if (!parsed.success) {
    throw new Error(`Invalid learning-core environment:\n${formatEnvIssues(parsed.error.issues)}`);
  }

  cachedLearningCoreEnv = parsed.data;
  return cachedLearningCoreEnv;
}
