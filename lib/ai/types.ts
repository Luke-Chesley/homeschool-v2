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
  "planning.adjust_day_load",
  "planning.defer_or_move_item",
  "planning.generate_today_lesson",
  "tracking.record_note",
]);
export type CopilotActionKind = z.infer<typeof CopilotActionKindSchema>;

export const CopilotActionConfidenceSchema = z.enum(["low", "medium", "high"]);
export type CopilotActionConfidence = z.infer<typeof CopilotActionConfidenceSchema>;

export const CopilotActionStatusSchema = z.enum([
  "pending",
  "applying",
  "applied",
  "failed",
  "dismissed",
]);
export type CopilotActionStatus = z.infer<typeof CopilotActionStatusSchema>;

export const CopilotActionTargetSchema = z.object({
  entityType: z.enum([
    "weekly_route_item",
    "planning_day",
    "today_lesson",
    "lesson_session",
    "tracking_note",
  ]),
  entityId: z.string().min(1).optional(),
  secondaryEntityId: z.string().min(1).optional(),
  date: z.string().optional(),
});
export type CopilotActionTarget = z.infer<typeof CopilotActionTargetSchema>;

const PlanningRouteMovePayloadSchema = z.object({
  weeklyRouteId: z.string().min(1),
  weeklyRouteItemId: z.string().min(1),
  currentDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  targetIndex: z.number().int().nonnegative().default(0),
  reason: z.string().trim().min(1).max(500),
});

export const GenerateTodayLessonPayloadSchema = z.object({
  date: z.string().min(1),
  slotId: z.string().nullable().optional(),
  reason: z.string().trim().min(1).max(500),
});
export type GenerateTodayLessonPayload = z.infer<typeof GenerateTodayLessonPayloadSchema>;

export const TrackingRecordNotePayloadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(2_000),
  noteType: z.enum(["general", "mastery", "adaptation_signal"]).default("general"),
  planItemId: z.string().nullable().optional(),
  lessonSessionId: z.string().nullable().optional(),
});
export type TrackingRecordNotePayload = z.infer<typeof TrackingRecordNotePayloadSchema>;

const CopilotActionDraftBaseSchema = z.object({
  id: z.string(),
  kind: CopilotActionKindSchema,
  label: z.string(),
  description: z.string().min(1),
  rationale: z.string().min(1).optional(),
  confidence: CopilotActionConfidenceSchema.optional(),
  requiresApproval: z.boolean().default(true),
  target: CopilotActionTargetSchema.optional(),
});

export const PlanningAdjustDayLoadActionDraftSchema = CopilotActionDraftBaseSchema.extend({
  kind: z.literal("planning.adjust_day_load"),
  payload: PlanningRouteMovePayloadSchema,
});

export const PlanningDeferOrMoveItemActionDraftSchema = CopilotActionDraftBaseSchema.extend({
  kind: z.literal("planning.defer_or_move_item"),
  payload: PlanningRouteMovePayloadSchema,
});

export const PlanningGenerateTodayLessonActionDraftSchema = CopilotActionDraftBaseSchema.extend({
  kind: z.literal("planning.generate_today_lesson"),
  payload: GenerateTodayLessonPayloadSchema,
});

export const TrackingRecordNoteActionDraftSchema = CopilotActionDraftBaseSchema.extend({
  kind: z.literal("tracking.record_note"),
  payload: TrackingRecordNotePayloadSchema,
});

export const CopilotActionDraftSchema = z.discriminatedUnion("kind", [
  PlanningAdjustDayLoadActionDraftSchema,
  PlanningDeferOrMoveItemActionDraftSchema,
  PlanningGenerateTodayLessonActionDraftSchema,
  TrackingRecordNoteActionDraftSchema,
]);
export type CopilotActionDraft = z.infer<typeof CopilotActionDraftSchema>;

const CopilotActionLifecycleSchema = z.object({
  status: CopilotActionStatusSchema.default("pending"),
  createdAt: z.string().datetime(),
  lineageId: z.string().optional(),
  error: z.string().nullable().optional(),
  result: z
    .object({
      message: z.string().min(1),
      affectedPaths: z.array(z.string()).default([]),
      data: z.record(z.string(), z.unknown()).optional(),
    })
    .nullable()
    .optional(),
});

export const CopilotActionSchema = z.discriminatedUnion("kind", [
  PlanningAdjustDayLoadActionDraftSchema.merge(CopilotActionLifecycleSchema),
  PlanningDeferOrMoveItemActionDraftSchema.merge(CopilotActionLifecycleSchema),
  PlanningGenerateTodayLessonActionDraftSchema.merge(CopilotActionLifecycleSchema),
  TrackingRecordNoteActionDraftSchema.merge(CopilotActionLifecycleSchema),
]);
export type CopilotAction = z.infer<typeof CopilotActionSchema>;

export const CopilotChatArtifactSchema = z.object({
  answer: z.string().min(1),
  actions: z.array(CopilotActionDraftSchema).default([]),
});
export type CopilotChatArtifact = z.infer<typeof CopilotChatArtifactSchema>;

export const CopilotActionMutationRequestSchema = z.object({
  sessionId: z.string().min(1),
  actionId: z.string().min(1),
});
export type CopilotActionMutationRequest = z.infer<typeof CopilotActionMutationRequestSchema>;

export const CopilotActionMutationResponseSchema = z.object({
  ok: z.literal(true),
  action: CopilotActionSchema,
});
export type CopilotActionMutationResponse = z.infer<typeof CopilotActionMutationResponseSchema>;

export const CopilotStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session"),
    sessionId: z.string().min(1),
  }),
  z.object({
    type: z.literal("delta"),
    delta: z.string(),
  }),
  z.object({
    type: z.literal("actions"),
    actions: z.array(CopilotActionSchema),
  }),
  z.object({
    type: z.literal("done"),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string().min(1),
  }),
]);
export type CopilotStreamEvent = z.infer<typeof CopilotStreamEventSchema>;

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
