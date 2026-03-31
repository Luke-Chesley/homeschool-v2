import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { createRepositories } from "@/lib/db/repositories";
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
    const [{ exists }] = await client<{ exists: string | null }[]>`
      select to_regclass('public.organizations') as exists
    `;

    if (!exists) {
      const sqlPath = path.join(process.cwd(), "drizzle", "0000_initial.sql");
      const schemaSql = await readFile(sqlPath, "utf8");
      await client.unsafe(schemaSql);
    }
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
