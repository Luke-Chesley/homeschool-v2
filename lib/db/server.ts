import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { createRepositories } from "@/lib/db/repositories";
import { applySqlMigrations } from "@/lib/db/migrations";
import * as schema from "@/lib/db/schema";
import { getDatabaseEnv } from "@/lib/env/server";

declare global {
  var __homeschoolSql: ReturnType<typeof postgres> | undefined;
  var __homeschoolDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

let readyPromise: Promise<void> | null = null;

function getSqlClient() {
  if (!globalThis.__homeschoolSql) {
    globalThis.__homeschoolSql = postgres(getDatabaseEnv().DATABASE_URL, {
      idle_timeout: 5,
      max: 1,
      prepare: false,
      onnotice: () => {},
    });
  }

  return globalThis.__homeschoolSql;
}

export async function ensureDatabaseReady() {
  if (readyPromise) {
    return readyPromise;
  }

  readyPromise = (async () => {
    const client = getSqlClient();
    await applySqlMigrations(client, { cwd: process.cwd() });
  })().catch((error) => {
    readyPromise = null;
    throw error;
  });

  return readyPromise;
}

export function getDb() {
  if (!globalThis.__homeschoolDb) {
    globalThis.__homeschoolDb = drizzle(getSqlClient(), { schema });
  }

  return globalThis.__homeschoolDb;
}

export function getRepositories() {
  return createRepositories(getDb());
}
