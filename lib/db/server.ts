import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { HomeschoolDb } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";
import * as schema from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env/server";

let sqlClient: postgres.Sql | null = null;
let db: HomeschoolDb | null = null;
let readyPromise: Promise<void> | null = null;

function getSqlClient() {
  if (sqlClient) {
    return sqlClient;
  }

  sqlClient = postgres(getServerEnv().DATABASE_URL, {
    idle_timeout: 5,
    max: 1,
    prepare: false,
    onnotice: () => {},
  });

  return sqlClient;
}

async function ensureDatabaseReady() {
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

export async function getDb(): Promise<HomeschoolDb> {
  await ensureDatabaseReady();

  if (!db) {
    db = drizzle(getSqlClient(), { schema }) as HomeschoolDb;
  }

  return db;
}

export async function getRepositories() {
  return createRepositories(await getDb());
}
