import { sql } from "drizzle-orm";
import { integer, jsonb, timestamp } from "drizzle-orm/pg-core";

import { createId } from "@/lib/db/ids";

export type JsonObject = Record<string, unknown>;

export function prefixedId(prefix: string) {
  return createId(prefix);
}

export function metadataColumn(name = "metadata") {
  return jsonb(name).$type<JsonObject>().notNull().default(sql`'{}'::jsonb`);
}

export function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  };
}

export function orderingColumn(name = "ordering") {
  return integer(name).notNull().default(0);
}
