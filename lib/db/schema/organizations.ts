import {
  boolean,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";

export const organizationTypeEnum = pgEnum("organization_type", [
  "household",
  "tutor_practice",
  "co_op",
  "school_like",
]);

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "educator",
  "observer",
]);

export const adultUsers = pgTable(
  "adult_users",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("adult")),
    authUserId: text("auth_user_id").notNull(),
    email: text("email").notNull(),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    authUserIdUnique: uniqueIndex("adult_users_auth_user_id_idx").on(table.authUserId),
    emailUnique: uniqueIndex("adult_users_email_idx").on(table.email),
  }),
);

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("org")),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: organizationTypeEnum("type").notNull(),
    timezone: text("timezone").notNull().default("America/Los_Angeles"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    slugUnique: uniqueIndex("organizations_slug_idx").on(table.slug),
  }),
);

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("mbr")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    adultUserId: text("adult_user_id")
      .notNull()
      .references(() => adultUsers.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    membershipUnique: uniqueIndex("memberships_org_adult_idx").on(
      table.organizationId,
      table.adultUserId,
    ),
  }),
);
