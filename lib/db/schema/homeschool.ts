import { sql } from "drizzle-orm";
import { date, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { compliancePrograms } from "@/lib/db/schema/compliance";
import { learners } from "@/lib/db/schema/learners";
import { adultUsers, organizations } from "@/lib/db/schema/organizations";
import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";

export const homeschoolAttendanceStatusEnum = pgEnum("homeschool_attendance_status", [
  "present",
  "partial",
  "absent",
  "excused",
  "non_instructional",
  "field_trip",
  "holiday",
]);

export const homeschoolAttendanceSourceEnum = pgEnum("homeschool_attendance_source", [
  "manual",
  "derived_from_sessions",
  "imported",
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

export const homeschoolAttendanceRecords = pgTable(
  "homeschool_attendance_records",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("attendance")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    complianceProgramId: text("compliance_program_id").references(() => compliancePrograms.id, {
      onDelete: "set null",
    }),
    attendanceDate: date("attendance_date").notNull(),
    status: homeschoolAttendanceStatusEnum("status").notNull().default("present"),
    source: homeschoolAttendanceSourceEnum("source").notNull().default("manual"),
    minutes: integer("minutes"),
    note: text("note"),
    derivedSessionIds: jsonb("derived_session_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    homeschoolAttendanceProgramDateIdx: index("homeschool_attendance_program_date_idx").on(
      table.complianceProgramId,
      table.attendanceDate,
    ),
    homeschoolAttendanceLearnerDateUnique: uniqueIndex(
      "homeschool_attendance_learner_date_unique_idx",
    ).on(table.learnerId, table.attendanceDate),
  }),
);

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
