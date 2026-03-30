import { date, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { organizations } from "@/lib/db/schema/organizations";
import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";

export const learnerStatusEnum = pgEnum("learner_status", ["active", "paused", "archived"]);
export const learningGoalStatusEnum = pgEnum("learning_goal_status", [
  "draft",
  "active",
  "completed",
  "archived",
]);

export const learners = pgTable("learners", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("learner")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  displayName: text("display_name").notNull(),
  dateOfBirth: date("date_of_birth"),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  status: learnerStatusEnum("status").notNull().default("active"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const learnerProfiles = pgTable(
  "learner_profiles",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("profile")),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    gradeLevel: text("grade_level"),
    readingLevel: text("reading_level"),
    supportNeeds: metadataColumn("support_needs"),
    interests: metadataColumn("interests"),
    schedulePreferences: metadataColumn("schedule_preferences"),
    notes: text("notes"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    learnerProfileUnique: uniqueIndex("learner_profiles_learner_idx").on(table.learnerId),
  }),
);

export const learningGoals = pgTable("learning_goals", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("goal")),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  subject: text("subject"),
  targetDate: date("target_date"),
  status: learningGoalStatusEnum("status").notNull().default("draft"),
  metadata: metadataColumn(),
  ...timestamps(),
});
