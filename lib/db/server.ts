import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/lib/db/schema";
import { getDatabaseEnv } from "@/lib/env/server";

declare global {
  var __homeschoolSql: ReturnType<typeof postgres> | undefined;
  var __homeschoolDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function getSqlClient() {
  if (!globalThis.__homeschoolSql) {
    globalThis.__homeschoolSql = postgres(getDatabaseEnv().DATABASE_URL, {
      prepare: false,
      max: 1,
    });
  }

  return globalThis.__homeschoolSql;
}

export function getDb() {
  if (!globalThis.__homeschoolDb) {
    globalThis.__homeschoolDb = drizzle(getSqlClient(), { schema });
  }

  return globalThis.__homeschoolDb;
}
