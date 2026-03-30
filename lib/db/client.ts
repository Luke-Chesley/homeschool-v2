import type { PgDatabase } from "drizzle-orm/pg-core";

import * as schema from "@/lib/db/schema";

export type HomeschoolDb = PgDatabase<any, typeof schema>;

export type TransactionCallback<T> = (tx: HomeschoolDb) => Promise<T>;

export async function withTransaction<T>(db: HomeschoolDb, callback: TransactionCallback<T>) {
  return db.transaction(async (tx) => callback(tx as HomeschoolDb));
}
