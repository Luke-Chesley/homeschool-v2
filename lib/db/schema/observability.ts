import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { learners } from "@/lib/db/schema/learners";
import { organizations } from "@/lib/db/schema/organizations";
import { metadataColumn, prefixedId } from "@/lib/db/schema/shared";

export const productEvents = pgTable(
  "product_events",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("pevt")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    learnerId: text("learner_id").references(() => learners.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    metadata: metadataColumn(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    productEventsOrgIdx: index("product_events_org_idx").on(table.organizationId, table.createdAt),
    productEventsNameIdx: index("product_events_name_idx").on(table.name, table.createdAt),
    productEventsLearnerIdx: index("product_events_learner_idx").on(table.learnerId, table.createdAt),
  }),
);
