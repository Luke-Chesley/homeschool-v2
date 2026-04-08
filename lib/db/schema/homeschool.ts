import { date, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

import { learners } from "@/lib/db/schema/learners";
import { adultUsers, organizations } from "@/lib/db/schema/organizations";
import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";

export const homeschoolAttendanceStatusEnum = pgEnum("homeschool_attendance_status", [
  "present",
  "partial",
  "absent",
  "field_trip",
  "holiday",
]);

export const homeschoolAuditEntityTypeEnum = pgEnum("homeschool_audit_entity_type", [
  "onboarding",
  "curriculum",
  "weekly_plan",
  "today_workspace",
  "attendance",
  "report",
  "preference",
]);

export const homeschoolAttendanceRecords = pgTable("homeschool_attendance_records", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("attendance")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  status: homeschoolAttendanceStatusEnum("status").notNull().default("present"),
  minutes: integer("minutes"),
  note: text("note"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const homeschoolAuditEvents = pgTable("homeschool_audit_events", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("audit")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id").references(() => learners.id, { onDelete: "set null" }),
  adultUserId: text("adult_user_id").references(() => adultUsers.id, { onDelete: "set null" }),
  entityType: homeschoolAuditEntityTypeEnum("entity_type").notNull(),
  entityId: text("entity_id"),
  eventType: text("event_type").notNull(),
  summary: text("summary").notNull(),
  metadata: metadataColumn(),
  ...timestamps(),
});
