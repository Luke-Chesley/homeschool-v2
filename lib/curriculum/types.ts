import { z } from "zod";

import {
  IntakeSourcePackageContextSchema,
  IntakeSourcePackageModalitySchema,
} from "@/lib/homeschool/intake/types";

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
  "single_day",
  "few_days",
  "one_week",
  "two_weeks",
  "starter_module",
]);
export const CurriculumSourceRecommendedHorizonSchema = CurriculumSourceGenerationHorizonSchema;

export const CurriculumSourceHorizonDecisionSourceSchema = z.enum([
  "model_inferred",
  "internal_override",
  "confidence_limited",
  "manual_regeneration",
]);

export const CurriculumSourceIntakeConfidenceSchema = z.enum(["low", "medium", "high"]);

export const CurriculumSourceInterpretKindSchema = z.enum([
  "bounded_material",
  "timeboxed_plan",
  "structured_sequence",
  "comprehensive_source",
  "topic_seed",
  "shell_request",
  "ambiguous",
]);

export const CurriculumSourceEntryStrategySchema = z.enum([
  "use_as_is",
  "explicit_range",
  "sequential_start",
  "section_start",
  "timebox_start",
  "scaffold_only",
]);

export const CurriculumSourceContinuationModeSchema = z.enum([
  "none",
  "sequential",
  "timebox",
  "manual_review",
]);

export type CurriculumSourceInterpretKind = z.infer<typeof CurriculumSourceInterpretKindSchema>;
export type CurriculumSourceEntryStrategy = z.infer<typeof CurriculumSourceEntryStrategySchema>;
export type CurriculumSourceContinuationMode = z.infer<
  typeof CurriculumSourceContinuationModeSchema
>;
export type CurriculumSourceRecommendedHorizon = z.infer<
  typeof CurriculumSourceRecommendedHorizonSchema
>;

export type CurriculumSourceHorizonDecisionSource = z.infer<
  typeof CurriculumSourceHorizonDecisionSourceSchema
>;

export const CurriculumSourceModelSchema = z.object({
  requestedRoute: CurriculumSourceIntakeRouteSchema.optional(),
  routedRoute: CurriculumSourceIntakeRouteSchema,
  confidence: CurriculumSourceIntakeConfidenceSchema,
  sourceKind: CurriculumSourceInterpretKindSchema.optional(),
  entryStrategy: CurriculumSourceEntryStrategySchema.optional(),
  entryLabel: z.string().nullable().optional(),
  continuationMode: CurriculumSourceContinuationModeSchema.optional(),
  recommendedHorizon: CurriculumSourceRecommendedHorizonSchema,
  assumptions: z.array(z.string()).default([]),
  detectedChunks: z.array(z.string()).default([]),
  followUpQuestion: z.string().nullable().optional(),
  needsConfirmation: z.boolean().optional(),
  sourcePackageIds: z.array(z.string()).default([]),
  sourcePackages: z.array(IntakeSourcePackageContextSchema).default([]),
  sourceModalities: z.array(IntakeSourcePackageModalitySchema).default([]),
  sourcePackageId: z.string().nullable().optional(),
  sourceModality: IntakeSourcePackageModalitySchema.optional(),
  lineage: JsonRecordSchema.optional(),
});

export type CurriculumSourceModel = z.infer<typeof CurriculumSourceModelSchema>;

export const CurriculumLaunchPlanSchema = z.object({
  chosenHorizon: CurriculumSourceGenerationHorizonSchema,
  horizonDecisionSource: CurriculumSourceHorizonDecisionSourceSchema,
  scopeSummary: z.string().nullable().optional(),
  initialSliceUsed: z.boolean().optional(),
  initialSliceLabel: z.string().nullable().optional(),
  openingLessonCount: z.number().int().positive().optional(),
  lastGeneratedLessonTitle: z.string().nullable().optional(),
});

export type CurriculumLaunchPlan = z.infer<typeof CurriculumLaunchPlanSchema>;

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function copyIfDefined(target: Record<string, unknown>, key: string, value: unknown) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function normalizeCurriculumSourceIntake(input: unknown) {
  if (!isJsonRecord(input)) {
    return input;
  }

  const record: Record<string, unknown> = { ...input };
  const sourceModel: Record<string, unknown> = isJsonRecord(record.sourceModel)
    ? { ...record.sourceModel }
    : {};
  const launchPlan: Record<string, unknown> = isJsonRecord(record.launchPlan)
    ? { ...record.launchPlan }
    : {};

  copyIfDefined(sourceModel, "requestedRoute", sourceModel.requestedRoute ?? record.requestedRoute);
  copyIfDefined(sourceModel, "routedRoute", sourceModel.routedRoute ?? record.route);
  copyIfDefined(sourceModel, "confidence", sourceModel.confidence ?? record.confidence);
  copyIfDefined(sourceModel, "sourceKind", sourceModel.sourceKind ?? record.sourceKind);
  copyIfDefined(sourceModel, "entryStrategy", sourceModel.entryStrategy ?? record.entryStrategy);
  copyIfDefined(sourceModel, "entryLabel", sourceModel.entryLabel ?? record.entryLabel);
  copyIfDefined(
    sourceModel,
    "continuationMode",
    sourceModel.continuationMode ?? record.continuationMode,
  );
  copyIfDefined(
    sourceModel,
    "recommendedHorizon",
    sourceModel.recommendedHorizon ?? record.recommendedHorizon,
  );
  copyIfDefined(sourceModel, "assumptions", sourceModel.assumptions ?? record.assumptions);
  copyIfDefined(sourceModel, "detectedChunks", sourceModel.detectedChunks ?? record.detectedChunks);
  copyIfDefined(
    sourceModel,
    "followUpQuestion",
    sourceModel.followUpQuestion ?? record.followUpQuestion,
  );
  copyIfDefined(
    sourceModel,
    "needsConfirmation",
    sourceModel.needsConfirmation ?? record.needsConfirmation,
  );
  copyIfDefined(
    sourceModel,
    "sourcePackageIds",
    sourceModel.sourcePackageIds ?? record.sourcePackageIds,
  );
  copyIfDefined(
    sourceModel,
    "sourcePackages",
    sourceModel.sourcePackages ?? record.sourcePackages,
  );
  copyIfDefined(
    sourceModel,
    "sourceModalities",
    sourceModel.sourceModalities ?? record.sourceModalities,
  );
  copyIfDefined(
    sourceModel,
    "sourcePackageId",
    sourceModel.sourcePackageId ?? record.sourcePackageId,
  );
  copyIfDefined(
    sourceModel,
    "sourceModality",
    sourceModel.sourceModality ?? record.sourceModality,
  );

  copyIfDefined(launchPlan, "chosenHorizon", launchPlan.chosenHorizon ?? record.chosenHorizon);
  copyIfDefined(
    launchPlan,
    "horizonDecisionSource",
    launchPlan.horizonDecisionSource ?? record.horizonDecisionSource,
  );
  copyIfDefined(
    launchPlan,
    "scopeSummary",
    launchPlan.scopeSummary ?? record.scopeSummary,
  );
  copyIfDefined(
    launchPlan,
    "initialSliceUsed",
    launchPlan.initialSliceUsed ?? record.initialSliceUsed,
  );
  copyIfDefined(
    launchPlan,
    "initialSliceLabel",
    launchPlan.initialSliceLabel ?? record.initialSliceLabel,
  );
  copyIfDefined(
    launchPlan,
    "openingLessonCount",
    launchPlan.openingLessonCount,
  );
  copyIfDefined(
    launchPlan,
    "lastGeneratedLessonTitle",
    launchPlan.lastGeneratedLessonTitle ?? record.lastGeneratedLessonTitle,
  );

  record.sourceModel = Object.keys(sourceModel).length > 0 ? sourceModel : undefined;
  record.launchPlan = Object.keys(launchPlan).length > 0 ? launchPlan : undefined;

  record.route ??= sourceModel.routedRoute;
  record.requestedRoute ??= sourceModel.requestedRoute;
  record.confidence ??= sourceModel.confidence;
  record.sourceKind ??= sourceModel.sourceKind;
  record.entryStrategy ??= sourceModel.entryStrategy;
  record.entryLabel ??= sourceModel.entryLabel;
  record.continuationMode ??= sourceModel.continuationMode;
  record.recommendedHorizon ??= sourceModel.recommendedHorizon;
  record.assumptions ??= sourceModel.assumptions;
  record.detectedChunks ??= sourceModel.detectedChunks;
  record.followUpQuestion ??= sourceModel.followUpQuestion;
  record.needsConfirmation ??= sourceModel.needsConfirmation;
  record.sourcePackageIds ??= sourceModel.sourcePackageIds;
  record.sourcePackages ??= sourceModel.sourcePackages;
  record.sourceModalities ??= sourceModel.sourceModalities;
  record.sourcePackageId ??= sourceModel.sourcePackageId;
  record.sourceModality ??= sourceModel.sourceModality;
  record.chosenHorizon ??= launchPlan.chosenHorizon;
  record.horizonDecisionSource ??= launchPlan.horizonDecisionSource;
  record.scopeSummary ??= launchPlan.scopeSummary;
  record.initialSliceUsed ??= launchPlan.initialSliceUsed;
  record.initialSliceLabel ??= launchPlan.initialSliceLabel;

  return record;
}

export const CurriculumSourceIntakeSchema = z.preprocess(
  normalizeCurriculumSourceIntake,
  z.object({
    route: CurriculumSourceIntakeRouteSchema,
    requestedRoute: CurriculumSourceIntakeRouteSchema.optional(),
    routeVersion: z.literal(1),
    rawText: z.string().nullable().optional(),
    assetIds: z.array(z.string()).default([]),
    learnerId: z.string().nullable().optional(),
    confidence: CurriculumSourceIntakeConfidenceSchema,
    sourceKind: CurriculumSourceInterpretKindSchema.optional(),
    entryStrategy: CurriculumSourceEntryStrategySchema.optional(),
    entryLabel: z.string().nullable().optional(),
    continuationMode: CurriculumSourceContinuationModeSchema.optional(),
    initialSliceUsed: z.boolean().optional(),
    initialSliceLabel: z.string().nullable().optional(),
    recommendedHorizon: CurriculumSourceRecommendedHorizonSchema,
    chosenHorizon: CurriculumSourceGenerationHorizonSchema,
    horizonDecisionSource: CurriculumSourceHorizonDecisionSourceSchema,
    scopeSummary: z.string().nullable().optional(),
    assumptions: z.array(z.string()).default([]),
    detectedChunks: z.array(z.string()).default([]),
    followUpQuestion: z.string().nullable().optional(),
    needsConfirmation: z.boolean().optional(),
    sourcePackageIds: z.array(z.string()).default([]),
    sourcePackages: z.array(IntakeSourcePackageContextSchema).default([]),
    sourceModalities: z.array(IntakeSourcePackageModalitySchema).default([]),
    sourcePackageId: z.string().nullable().optional(),
    sourceModality: IntakeSourcePackageModalitySchema.optional(),
    sourceModel: CurriculumSourceModelSchema.optional(),
    launchPlan: CurriculumLaunchPlanSchema.optional(),
    curriculumLineage: JsonRecordSchema.optional(),
    sourceFingerprint: z.string().optional(),
    createdFrom: z.enum([
      "onboarding_fast_path",
      "curriculum_add_flow",
      "curriculum_regeneration",
    ]),
  }),
);

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
  sourceModel: CurriculumSourceModelSchema.optional(),
  launchPlan: CurriculumLaunchPlanSchema.optional(),
  curriculumLineage: JsonRecordSchema.optional(),
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
