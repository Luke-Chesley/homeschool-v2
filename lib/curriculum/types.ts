import { z } from "zod";

export type CurriculumSourceKind =
  | "manual"
  | "upload"
  | "ai_draft"
  | "external";

export type CurriculumSourceStatus =
  | "draft"
  | "active"
  | "archived"
  | "failed_import";

export type CurriculumNodeType =
  | "domain"
  | "strand"
  | "goal_group"
  | "skill";

export const CurriculumSourceKindSchema = z.enum([
  "manual",
  "upload",
  "ai_draft",
  "external",
]);

export const CurriculumSourceStatusSchema = z.enum([
  "draft",
  "active",
  "archived",
  "failed_import",
]);

export const CurriculumNodeTypeSchema = z.enum([
  "domain",
  "strand",
  "goal_group",
  "skill",
]);

export const JsonRecordSchema = z.record(z.string(), z.unknown());

/**
 * Source-level pacing contract extracted from the AI generation artifact.
 * These values survive beyond the raw artifact and are the authoritative
 * source of session timing for planning and lesson-draft generation.
 */
export const CurriculumSourcePacingSchema = z.object({
  sessionMinutes: z.number().int().positive().optional(),
  sessionsPerWeek: z.number().positive().optional(),
  totalWeeks: z.number().int().positive().optional(),
  totalSessions: z.number().int().positive().optional(),
});

export type CurriculumSourcePacing = z.infer<typeof CurriculumSourcePacingSchema>;

export const CurriculumSourceIntakeRouteSchema = z.enum([
  "single_lesson",
  "weekly_plan",
  "outline",
  "topic",
  "manual_shell",
]);

export const CurriculumSourceGenerationHorizonSchema = z.enum([
  "today",
  "tomorrow",
  "next_few_days",
  "current_week",
  "starter_module",
  "starter_week",
]);

export const CurriculumSourceHorizonDecisionSourceSchema = z.enum([
  "system_default",
  "confidence_limited",
  "user_selected",
  "user_corrected_in_preview",
  "manual_regeneration",
]);

export const CurriculumSourceIntakeConfidenceSchema = z.enum(["low", "medium", "high"]);

export const CurriculumSourceIntakeSchema = z.object({
  route: CurriculumSourceIntakeRouteSchema,
  routeVersion: z.literal(1),
  rawText: z.string().nullable().optional(),
  assetIds: z.array(z.string()).default([]),
  learnerId: z.string().nullable().optional(),
  confidence: CurriculumSourceIntakeConfidenceSchema,
  inferredHorizon: CurriculumSourceGenerationHorizonSchema,
  chosenHorizon: CurriculumSourceGenerationHorizonSchema,
  horizonDecisionSource: CurriculumSourceHorizonDecisionSourceSchema,
  assumptions: z.array(z.string()).default([]),
  detectedChunks: z.array(z.string()).default([]),
  sourceFingerprint: z.string().optional(),
  createdFrom: z.enum(["onboarding_fast_path", "curriculum_add_flow", "curriculum_regeneration"]),
});

export type CurriculumSourceIntake = z.infer<typeof CurriculumSourceIntakeSchema>;

export const CurriculumSourceSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  kind: CurriculumSourceKindSchema,
  status: CurriculumSourceStatusSchema,
  academicYear: z.string().optional(),
  subjects: z.array(z.string()).default([]),
  gradeLevels: z.array(z.string()).default([]),
  storagePath: z.string().optional(),
  indexingStatus: z.enum(["pending", "indexed", "failed", "not_applicable"]).default("not_applicable"),
  importVersion: z.number().int().positive().default(1),
  /** Pacing contract from curriculum generation. Use this as the session budget source. */
  pacing: CurriculumSourcePacingSchema.optional(),
  intake: CurriculumSourceIntakeSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CurriculumSource = z.infer<typeof CurriculumSourceSchema>;

export const CurriculumNodeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  parentNodeId: z.string().nullable(),
  normalizedType: CurriculumNodeTypeSchema,
  title: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  sequenceIndex: z.number().int().nonnegative(),
  depth: z.number().int().nonnegative(),
  normalizedPath: z.string().min(1),
  originalLabel: z.string().optional(),
  originalType: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  sourcePayload: JsonRecordSchema.default({}),
  metadata: JsonRecordSchema.default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CurriculumNode = z.infer<typeof CurriculumNodeSchema>;

export interface CurriculumTreeNode extends CurriculumNode {
  children: CurriculumTreeNode[];
}

export interface CurriculumTree {
  source: CurriculumSource;
  rootNodes: CurriculumTreeNode[];
  nodeCount: number;
  skillCount: number;
  canonicalSkillNodeIds: string[];
}

export const CurriculumUnitSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  sequence: z.number().int().nonnegative(),
  estimatedWeeks: z.number().optional(),
  estimatedSessions: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CurriculumUnit = z.infer<typeof CurriculumUnitSchema>;

export const CurriculumLessonSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  subject: z.string().optional(),
  sequence: z.number().int().nonnegative(),
  estimatedMinutes: z.number().optional(),
  materials: z.array(z.string()).default([]),
  objectives: z.array(z.string()).default([]),
  linkedSkillTitles: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CurriculumLesson = z.infer<typeof CurriculumLessonSchema>;

export const CurriculumObjectiveSchema = z.object({
  id: z.string(),
  lessonId: z.string().optional(),
  unitId: z.string().optional(),
  description: z.string().min(1),
  standardIds: z.array(z.string()).default([]),
  customGoalIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CurriculumObjective = z.infer<typeof CurriculumObjectiveSchema>;

export interface CurriculumUnitOutline extends CurriculumUnit {
  lessons: CurriculumLesson[];
}

export const CreateCurriculumSourceInputSchema = CurriculumSourceSchema.omit({
  id: true,
  status: true,
  importVersion: true,
  createdAt: true,
  updatedAt: true,
  indexingStatus: true,
});
export type CreateCurriculumSourceInput = z.infer<typeof CreateCurriculumSourceInputSchema>;

export const CreateCurriculumUnitInputSchema = CurriculumUnitSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateCurriculumUnitInput = z.infer<typeof CreateCurriculumUnitInputSchema>;

export const CreateCurriculumLessonInputSchema = CurriculumLessonSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateCurriculumLessonInput = z.infer<typeof CreateCurriculumLessonInputSchema>;

export const CreateCurriculumObjectiveInputSchema = CurriculumObjectiveSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateCurriculumObjectiveInput = z.infer<typeof CreateCurriculumObjectiveInputSchema>;
