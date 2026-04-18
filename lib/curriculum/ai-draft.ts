import { z } from "zod";

import {
  CurriculumSourceContinuationModeSchema,
  CurriculumSourceEntryStrategySchema,
  CurriculumSourceRecommendedHorizonSchema,
  JsonRecordSchema,
  CurriculumLessonTypeSchema,
} from "./types.ts";

const CurriculumAiChatRoleSchema = z.enum(["user", "assistant"]);

export const CurriculumAiChatMessageSchema = z.object({
  role: CurriculumAiChatRoleSchema,
  content: z.string().trim().min(1).max(8_000),
});

export type CurriculumAiChatMessage = z.infer<typeof CurriculumAiChatMessageSchema>;

export const CurriculumAiCapturedRequirementsSchema = z.object({
  topic: z.string().default(""),
  goals: z.string().default(""),
  timeframe: z.string().default(""),
  learnerProfile: z.string().default(""),
  constraints: z.string().default(""),
  teachingStyle: z.string().default(""),
  assessment: z.string().default(""),
  structurePreferences: z.string().default(""),
});

export type CurriculumAiCapturedRequirements = z.infer<
  typeof CurriculumAiCapturedRequirementsSchema
>;

export const CurriculumAiIntakeStateSchema = z.object({
  readiness: z.enum(["gathering", "ready"]),
  summary: z.string().trim().min(1).max(1_200),
  missingInformation: z.array(z.string().trim().min(1).max(240)).max(6).default([]),
  capturedRequirements: CurriculumAiCapturedRequirementsSchema,
});

export type CurriculumAiIntakeState = z.infer<typeof CurriculumAiIntakeStateSchema>;

export const CurriculumAiChatTurnSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(1_500),
  state: CurriculumAiIntakeStateSchema,
});

export type CurriculumAiChatTurn = z.infer<typeof CurriculumAiChatTurnSchema>;

export const CurriculumAiChatRequestSchema = z.object({
  messages: z.array(CurriculumAiChatMessageSchema).max(40).default([]),
});

function truncatedArraySchema<TItem extends z.ZodTypeAny>(itemSchema: TItem, max: number) {
  return z.preprocess(
    (value) => (Array.isArray(value) ? value.slice(0, max) : value),
    z.array(itemSchema).max(max).default([]),
  );
}

export const CurriculumAiDraftSummarySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(600),
  subjects: truncatedArraySchema(z.string().trim().min(1).max(80), 6),
  gradeLevels: truncatedArraySchema(z.string().trim().min(1).max(40), 4),
  academicYear: z.string().trim().min(1).max(80).optional(),
  summary: z.string().trim().min(1).max(1_200),
  teachingApproach: z.string().trim().min(1).max(400),
  successSignals: truncatedArraySchema(z.string().trim().min(1).max(220), 6),
  parentNotes: truncatedArraySchema(z.string().trim().min(1).max(260), 6),
  rationale: truncatedArraySchema(z.string().trim().min(1).max(260), 6),
});

export type CurriculumAiDraftSummary = z.infer<typeof CurriculumAiDraftSummarySchema>;

type CurriculumJsonNode = string | string[] | { [key: string]: CurriculumJsonNode };

export const CurriculumAiDocumentNodeSchema: z.ZodType<CurriculumJsonNode> = z.lazy(() =>
  z.union([
    z.string().trim().min(1).max(240),
    z.array(z.string().trim().min(1).max(240)).min(1).max(24),
    z.record(z.string().trim().min(1).max(180), CurriculumAiDocumentNodeSchema),
  ]),
);

export const CurriculumAiPacingSchema = z.object({
  totalWeeks: z.number().int().positive().max(104).optional(),
  sessionsPerWeek: z.number().positive().max(14).optional(),
  sessionMinutes: z.number().int().positive().max(240).optional(),
  totalSessions: z.number().int().positive().max(500).optional(),
  coverageStrategy: z.string().trim().min(1).max(800),
  coverageNotes: truncatedArraySchema(z.string().trim().min(1).max(220), 8),
});

export type CurriculumAiPacing = z.infer<typeof CurriculumAiPacingSchema>;

export const CurriculumAiLessonSchema = z.object({
  unitRef: z.string().trim().min(1).max(180),
  lessonRef: z.string().trim().min(1).max(180),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(600),
  subject: z.string().trim().min(1).max(80).optional(),
  lessonType: CurriculumLessonTypeSchema,
  estimatedMinutes: z.number().int().positive().max(240).optional(),
  materials: truncatedArraySchema(z.string().trim().min(1).max(180), 12),
  objectives: truncatedArraySchema(z.string().trim().min(1).max(220), 8),
  linkedSkillRefs: truncatedArraySchema(z.string().trim().min(1).max(1_000), 8),
});

export type CurriculumAiLesson = z.infer<typeof CurriculumAiLessonSchema>;

export const CurriculumAiUnitSchema = z.object({
  unitRef: z.string().trim().min(1).max(180),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(700),
  estimatedWeeks: z.number().positive().max(52).optional(),
  estimatedSessions: z.number().int().positive().max(160).optional(),
  lessons: z.array(CurriculumAiLessonSchema).min(1).max(16),
});

export type CurriculumAiUnit = z.infer<typeof CurriculumAiUnitSchema>;

export const CurriculumAiProgressionEdgeKindSchema = z.enum([
  "hardPrerequisite",
  "recommendedBefore",
  "revisitAfter",
  "coPractice",
]);

export type CurriculumAiProgressionEdgeKind = z.infer<typeof CurriculumAiProgressionEdgeKindSchema>;

export const CurriculumAiProgressionEdgeSchema = z.object({
  fromSkillRef: z.string().trim().min(1).max(1_000),
  toSkillRef: z.string().trim().min(1).max(1_000),
  kind: CurriculumAiProgressionEdgeKindSchema,
});

export type CurriculumAiProgressionEdge = z.infer<typeof CurriculumAiProgressionEdgeSchema>;

export const CurriculumAiProgressionPhaseSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(600).optional(),
  skillRefs: z.array(z.string().trim().min(1).max(1_000)).min(1),
});

export type CurriculumAiProgressionPhase = z.infer<typeof CurriculumAiProgressionPhaseSchema>;

export const CurriculumAiProgressionSchema = z.object({
  phases: z.array(CurriculumAiProgressionPhaseSchema).default([]),
  edges: z.array(CurriculumAiProgressionEdgeSchema).default([]),
});

export type CurriculumAiProgression = z.infer<typeof CurriculumAiProgressionSchema>;

export const CurriculumLaunchPlanSchema = z.object({
  recommendedHorizon: CurriculumSourceRecommendedHorizonSchema,
  scopeSummary: z.string().trim().min(1).max(1_200),
  initialSliceUsed: z.boolean(),
  initialSliceLabel: z.string().trim().min(1).max(240).nullable().optional(),
  entryStrategy: CurriculumSourceEntryStrategySchema.nullable().optional(),
  entryLabel: z.string().trim().min(1).max(240).nullable().optional(),
  continuationMode: CurriculumSourceContinuationModeSchema.nullable().optional(),
  openingLessonRefs: z.array(z.string().trim().min(1).max(180)).min(1),
  openingSkillRefs: z.array(z.string().trim().min(1).max(1_000)).default([]),
});

export type CurriculumLaunchPlan = z.infer<typeof CurriculumLaunchPlanSchema>;

export const CurriculumAiGeneratedArtifactSchema = z.object({
  source: CurriculumAiDraftSummarySchema,
  intakeSummary: z.string().trim().min(1).max(1_500),
  pacing: CurriculumAiPacingSchema,
  document: z.record(z.string().trim().min(1).max(180), CurriculumAiDocumentNodeSchema),
  units: z.array(CurriculumAiUnitSchema).min(1).max(20),
  launchPlan: CurriculumLaunchPlanSchema,
  progression: CurriculumAiProgressionSchema.optional(),
});

export type CurriculumAiGeneratedArtifact = z.infer<typeof CurriculumAiGeneratedArtifactSchema>;
export type CurriculumAiDocumentNode = z.infer<typeof CurriculumAiDocumentNodeSchema>;

export const CurriculumAiCreateRequestSchema = z.object({
  messages: z.array(CurriculumAiChatMessageSchema).max(40).min(2),
});

export const CurriculumAiCreateResponseSchema = z.object({
  sourceId: z.string(),
  sourceTitle: z.string(),
  nodeCount: z.number().int().nonnegative(),
  skillCount: z.number().int().nonnegative(),
  unitCount: z.number().int().nonnegative(),
  lessonCount: z.number().int().nonnegative(),
  estimatedSessionCount: z.number().int().nonnegative(),
});

export type CurriculumAiCreateResponse = z.infer<typeof CurriculumAiCreateResponseSchema>;

export const CurriculumAiFailureStageSchema = z.enum([
  "generation",
  "parse",
  "schema",
  "persistence",
  "revision",
  "quality",
]);

export const CurriculumAiFailureIssueSchema = z.object({
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(400),
  path: z.array(z.string().trim().min(1).max(180)).max(12).default([]),
});

export type CurriculumAiFailureIssue = z.infer<typeof CurriculumAiFailureIssueSchema>;

export const CurriculumAiFailureResultSchema = z.object({
  kind: z.literal("failure"),
  stage: CurriculumAiFailureStageSchema,
  reason: z.string().trim().min(1).max(120),
  userSafeMessage: z.string().trim().min(1).max(500),
  issues: z.array(CurriculumAiFailureIssueSchema).default([]),
  attemptCount: z.number().int().nonnegative(),
  retryable: z.boolean(),
  debugMetadata: JsonRecordSchema.optional(),
});

export type CurriculumAiFailureResult = z.infer<typeof CurriculumAiFailureResultSchema>;

export const CurriculumAiCreateSuccessResponseSchema = CurriculumAiCreateResponseSchema.extend({
  kind: z.literal("success"),
});

export type CurriculumAiCreateSuccessResponse = z.infer<
  typeof CurriculumAiCreateSuccessResponseSchema
>;

export const CurriculumAiCreateResultSchema = z.union([
  CurriculumAiCreateSuccessResponseSchema,
  CurriculumAiFailureResultSchema,
]);

export type CurriculumAiCreateResult = z.infer<typeof CurriculumAiCreateResultSchema>;

export const CurriculumAiGenerateSuccessResultSchema = z.object({
  kind: z.literal("success"),
  artifact: CurriculumAiGeneratedArtifactSchema,
});

export const CurriculumAiGenerateResultSchema = z.union([
  CurriculumAiGenerateSuccessResultSchema,
  CurriculumAiFailureResultSchema,
]);

export type CurriculumAiGenerateSuccessResult = z.infer<
  typeof CurriculumAiGenerateSuccessResultSchema
>;

export type CurriculumAiGenerateResult = z.infer<typeof CurriculumAiGenerateResultSchema>;

export const CurriculumAiRevisionActionSchema = z.enum(["clarify", "apply"]);

export const CurriculumAiRevisionScopeSchema = z.enum(["targeted", "broader"]);

export const CurriculumAiRevisionOperationSchema = z.enum([
  "split",
  "rename",
  "adjust",
  "broader",
]);

export const CurriculumAiRevisionPlanSchema = z
  .object({
    assistantMessage: z.string().trim().min(1).max(1_500),
    action: CurriculumAiRevisionActionSchema,
    scope: CurriculumAiRevisionScopeSchema,
    operation: CurriculumAiRevisionOperationSchema,
    changeSummary: z.array(z.string().trim().min(1).max(220)).max(8).default([]),
    revisionBrief: z.string().trim().min(1).max(2_000).optional(),
    targetPath: z.array(z.string().trim().min(1).max(180)).max(8).default([]),
    replacementTitles: z.array(z.string().trim().min(1).max(180)).max(8).default([]),
    missingDetail: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "apply" && !value.revisionBrief) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "revisionBrief is required when action is apply",
        path: ["revisionBrief"],
      });
    }

    if (value.action === "apply" && value.operation === "rename" && value.replacementTitles.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "replacementTitles must include the new title for a rename revision",
        path: ["replacementTitles"],
      });
    }
  });

export type CurriculumAiRevisionPlan = z.infer<typeof CurriculumAiRevisionPlanSchema>;

export const CurriculumAiRevisionTurnSchema = z
  .object({
    assistantMessage: z.string().trim().min(1).max(1_500),
    action: CurriculumAiRevisionActionSchema,
    changeSummary: z.array(z.string().trim().min(1).max(220)).max(8).default([]),
    artifact: CurriculumAiGeneratedArtifactSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "apply" && !value.artifact) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "artifact is required when action is apply",
        path: ["artifact"],
      });
    }
  });

export type CurriculumAiRevisionTurn = z.infer<typeof CurriculumAiRevisionTurnSchema>;

export const CurriculumAiRevisionRequestSchema = z.object({
  messages: z.array(CurriculumAiChatMessageSchema).max(30).min(1),
});

export const CurriculumAiRevisionResponseSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(1_500),
  action: z.enum(["clarify", "applied"]),
  changeSummary: z.array(z.string().trim().min(1).max(220)).max(8).default([]),
  sourceId: z.string(),
  sourceTitle: z.string(),
  importVersion: z.number().int().positive().optional(),
  nodeCount: z.number().int().nonnegative().optional(),
  skillCount: z.number().int().nonnegative().optional(),
  unitCount: z.number().int().nonnegative().optional(),
  lessonCount: z.number().int().nonnegative().optional(),
  estimatedSessionCount: z.number().int().nonnegative().optional(),
});

export type CurriculumAiRevisionResponse = z.infer<typeof CurriculumAiRevisionResponseSchema>;

export const CurriculumAiRevisionAppliedResponseSchema = CurriculumAiRevisionResponseSchema.extend({
  kind: z.literal("applied"),
});

export const CurriculumAiRevisionClarifyResponseSchema = CurriculumAiRevisionResponseSchema.extend({
  kind: z.literal("clarify"),
});

export const CurriculumAiRevisionFailureResultSchema = CurriculumAiFailureResultSchema.extend({
  kind: z.literal("failure"),
});

export type CurriculumAiRevisionAppliedResponse = z.infer<
  typeof CurriculumAiRevisionAppliedResponseSchema
>;

export type CurriculumAiRevisionClarifyResponse = z.infer<
  typeof CurriculumAiRevisionClarifyResponseSchema
>;

export type CurriculumAiRevisionFailureResult = z.infer<
  typeof CurriculumAiRevisionFailureResultSchema
>;

export const CurriculumAiRevisionResultSchema = z.union([
  CurriculumAiRevisionAppliedResponseSchema,
  CurriculumAiRevisionClarifyResponseSchema,
  CurriculumAiRevisionFailureResultSchema,
]);

export type CurriculumAiRevisionResult = z.infer<typeof CurriculumAiRevisionResultSchema>;
