/**
 * Copilot-facing AI types that still belong to the product app.
 *
 * `learning-core` owns provider selection, prompt assembly, skill execution,
 * and lineage for extracted operations. `homeschool-v2` keeps only the
 * message, action, and context shapes needed to render product UI and call
 * the external service.
 */

import { z } from "zod";

export const ChatRoleSchema = z.enum(["user", "assistant", "system"]);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string(),
  /** ISO timestamp */
  createdAt: z.string().datetime().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const CopilotActionKindSchema = z.enum([
  "plan.add_lesson",
  "plan.adjust_schedule",
  "artifact.create",
  "recommendation.create",
  "standards.map",
]);
export type CopilotActionKind = z.infer<typeof CopilotActionKindSchema>;

export const CopilotActionSchema = z.object({
  id: z.string(),
  kind: CopilotActionKindSchema,
  label: z.string(),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(["pending", "applied", "dismissed"]).default("pending"),
  createdAt: z.string().datetime(),
  lineageId: z.string().optional(),
});
export type CopilotAction = z.infer<typeof CopilotActionSchema>;

export const CurriculumSnapshotSchema = z.object({
  sourceId: z.string().optional(),
  subjectFocus: z.array(z.string()).default([]),
  lessonLabels: z.array(z.string()).default([]),
  skillNodeIds: z.array(z.string()).default([]),
  weeklyRouteItemIds: z.array(z.string()).default([]),
  todayHighlights: z.array(z.string()).default([]),
});
export type CurriculumSnapshot = z.infer<typeof CurriculumSnapshotSchema>;

export const DailyWorkspaceItemSummarySchema = z.object({
  title: z.string(),
  subject: z.string(),
  objective: z.string(),
  lessonLabel: z.string(),
  status: z.string(),
  estimatedMinutes: z.number(),
  materials: z.array(z.string()).default([]),
  copilotPrompts: z.array(z.string()).default([]),
});

export const DailyWorkspaceSnapshotSchema = z.object({
  date: z.string(),
  headline: z.string(),
  leadLesson: z.object({
    title: z.string(),
    subject: z.string(),
    objective: z.string(),
    lessonLabel: z.string(),
    estimatedMinutes: z.number(),
  }),
  planItems: z.array(DailyWorkspaceItemSummarySchema).default([]),
  prepChecklist: z.array(z.string()).default([]),
  sessionTargets: z.array(z.string()).default([]),
  copilotInsertions: z.array(z.string()).default([]),
  completionPrompts: z.array(z.string()).default([]),
  familyNotes: z.array(z.string()).default([]),
});
export type DailyWorkspaceSnapshot = z.infer<typeof DailyWorkspaceSnapshotSchema>;

export const WeeklyPlanningSnapshotItemSchema = z.object({
  id: z.string(),
  skillTitle: z.string(),
  skillPath: z.string(),
  subject: z.string(),
  recommendedPosition: z.number(),
  currentPosition: z.number(),
  scheduledDate: z.string().nullable(),
  manualOverrideKind: z.string(),
  manualOverrideNote: z.string().nullable(),
  state: z.string(),
});

export const WeeklyPlanningSnapshotDaySchema = z.object({
  date: z.string(),
  label: z.string(),
  itemIds: z.array(z.string()).default([]),
  itemTitles: z.array(z.string()).default([]),
  scheduledMinutes: z.number(),
});

export const WeeklyPlanningSnapshotConflictSchema = z.object({
  type: z.string(),
  explanation: z.string(),
  affectedItemIds: z.array(z.string()).default([]),
  keepOverrideAllowed: z.boolean(),
});

export const WeeklyPlanningSnapshotSchema = z.object({
  weekStartDate: z.string(),
  weekLabel: z.string(),
  weeklyRouteId: z.string(),
  sourceId: z.string(),
  learnerId: z.string(),
  learnerName: z.string(),
  summary: z.object({
    itemCount: z.number(),
    scheduledCount: z.number(),
    unassignedCount: z.number(),
    conflictCount: z.number(),
    reorderedCount: z.number(),
    pinnedCount: z.number(),
    deferredCount: z.number(),
  }),
  days: z.array(WeeklyPlanningSnapshotDaySchema).default([]),
  items: z.array(WeeklyPlanningSnapshotItemSchema).default([]),
  conflicts: z.array(WeeklyPlanningSnapshotConflictSchema).default([]),
  highlights: z.array(z.string()).default([]),
});
export type WeeklyPlanningSnapshot = z.infer<typeof WeeklyPlanningSnapshotSchema>;

export const CopilotContextSchema = z.object({
  learnerId: z.string().optional(),
  learnerName: z.string().optional(),
  curriculumSourceId: z.string().optional(),
  lessonId: z.string().optional(),
  standardIds: z.array(z.string()).default([]),
  goalIds: z.array(z.string()).default([]),
  curriculumSnapshot: CurriculumSnapshotSchema.optional(),
  dailyWorkspaceSnapshot: DailyWorkspaceSnapshotSchema.optional(),
  weeklyPlanningSnapshot: WeeklyPlanningSnapshotSchema.optional(),
  feedbackNotes: z.array(z.string()).default([]),
  recentOutcomes: z.array(
    z.object({ title: z.string(), status: z.string(), date: z.string() })
  ).default([]),
});
export type CopilotContext = z.infer<typeof CopilotContextSchema>;
