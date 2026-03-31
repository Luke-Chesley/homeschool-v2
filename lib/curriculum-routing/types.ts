import { z } from "zod";

export const WeeklyRouteConflictTypeSchema = z.enum([
  "predecessor_not_completed",
  "explicit_prerequisite_blocked",
  "item_scheduled_twice",
  "weekly_capacity_exceeded",
  "reordered_ahead_of_predecessor",
]);

export type WeeklyRouteConflictType = z.infer<typeof WeeklyRouteConflictTypeSchema>;

export const WeeklyRouteRepairActionSchema = z.enum([
  "move_predecessor_earlier",
  "move_item_later",
  "acknowledge_skip",
  "drop_duplicate",
  "rebalance_over_capacity",
]);

export type WeeklyRouteRepairAction = z.infer<typeof WeeklyRouteRepairActionSchema>;

export const WeeklyRouteItemStateSchema = z.enum([
  "queued",
  "scheduled",
  "in_progress",
  "done",
  "removed",
]);

export type WeeklyRouteItemState = z.infer<typeof WeeklyRouteItemStateSchema>;

export const WeeklyRouteManualOverrideKindSchema = z.enum([
  "none",
  "reordered",
  "pinned",
  "deferred",
  "skip_acknowledged",
]);

export type WeeklyRouteManualOverrideKind = z.infer<typeof WeeklyRouteManualOverrideKindSchema>;

export const WeeklyRouteDailySelectionHandoffSchema = z.object({
  weeklyRouteItemId: z.string(),
  curriculumSourceId: z.string(),
  curriculumSkillNodeId: z.string(),
  currentPosition: z.number().int().nonnegative(),
  scheduledDate: z.string().nullable(),
  state: WeeklyRouteItemStateSchema,
});

export type WeeklyRouteDailySelectionHandoff = z.infer<
  typeof WeeklyRouteDailySelectionHandoffSchema
>;

export const WeeklyRouteBoardItemSchema = z.object({
  id: z.string(),
  weeklyRouteId: z.string(),
  learnerId: z.string(),
  sourceId: z.string(),
  skillNodeId: z.string(),
  skillTitle: z.string(),
  skillPath: z.string(),
  canonicalPosition: z.number().int().nonnegative(),
  recommendedPosition: z.number().int().nonnegative(),
  currentPosition: z.number().int().nonnegative(),
  scheduledDate: z.string().nullable(),
  manualOverrideKind: WeeklyRouteManualOverrideKindSchema,
  manualOverrideNote: z.string().nullable(),
  state: WeeklyRouteItemStateSchema,
  learnerSkillStatus: z.string(),
  explicitPrerequisiteSkillNodeIds: z.array(z.string()),
  predecessorSkillNodeIds: z.array(z.string()),
  dailySelection: WeeklyRouteDailySelectionHandoffSchema,
});

export type WeeklyRouteBoardItem = z.infer<typeof WeeklyRouteBoardItemSchema>;

export const WeeklyRouteConflictSchema = z.object({
  type: WeeklyRouteConflictTypeSchema,
  affectedItemIds: z.array(z.string()),
  blockingSkillNodeIds: z.array(z.string()),
  explanation: z.string(),
  suggestedRepairActions: z.array(WeeklyRouteRepairActionSchema),
  keepOverrideAllowed: z.boolean(),
});

export type WeeklyRouteConflict = z.infer<typeof WeeklyRouteConflictSchema>;

export const WeeklyRouteRepairOperationSchema = z.object({
  action: WeeklyRouteRepairActionSchema,
  itemId: z.string(),
  reason: z.string(),
  fromPosition: z.number().int().nonnegative().nullable(),
  toPosition: z.number().int().nonnegative().nullable(),
  fromState: WeeklyRouteItemStateSchema.nullable(),
  toState: WeeklyRouteItemStateSchema.nullable(),
  fromOverrideKind: WeeklyRouteManualOverrideKindSchema.nullable(),
  toOverrideKind: WeeklyRouteManualOverrideKindSchema.nullable(),
});

export type WeeklyRouteRepairOperation = z.infer<typeof WeeklyRouteRepairOperationSchema>;

export const WeeklyRouteSummarySchema = z.object({
  weeklyRouteId: z.string(),
  learnerId: z.string(),
  sourceId: z.string(),
  weekStartDate: z.string(),
  generationVersion: z.string(),
  status: z.enum(["draft", "active", "superseded", "archived"]),
  targetItemsPerWeek: z.number().int().nonnegative(),
  queuedItems: z.number().int().nonnegative(),
  removedItems: z.number().int().nonnegative(),
  doneItems: z.number().int().nonnegative(),
});

export type WeeklyRouteSummary = z.infer<typeof WeeklyRouteSummarySchema>;

export const WeeklyRouteBoardSchema = z.object({
  summary: WeeklyRouteSummarySchema,
  items: z.array(WeeklyRouteBoardItemSchema),
  conflicts: z.array(WeeklyRouteConflictSchema),
});

export type WeeklyRouteBoard = z.infer<typeof WeeklyRouteBoardSchema>;

export const WeeklyRouteRepairPreviewSchema = z.object({
  weeklyRouteId: z.string(),
  beforeConflicts: z.array(WeeklyRouteConflictSchema),
  afterConflicts: z.array(WeeklyRouteConflictSchema),
  operations: z.array(WeeklyRouteRepairOperationSchema),
  projectedItems: z.array(WeeklyRouteBoardItemSchema),
});

export type WeeklyRouteRepairPreview = z.infer<typeof WeeklyRouteRepairPreviewSchema>;
