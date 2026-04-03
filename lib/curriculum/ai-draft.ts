import { z } from "zod";

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

export const CurriculumAiDraftSummarySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(600),
  subjects: z.array(z.string().trim().min(1).max(80)).max(6).default([]),
  gradeLevels: z.array(z.string().trim().min(1).max(40)).max(4).default([]),
  academicYear: z.string().trim().min(1).max(80).optional(),
  summary: z.string().trim().min(1).max(1_200),
  teachingApproach: z.string().trim().min(1).max(400),
  successSignals: z.array(z.string().trim().min(1).max(220)).max(6).default([]),
  parentNotes: z.array(z.string().trim().min(1).max(260)).max(6).default([]),
  rationale: z.array(z.string().trim().min(1).max(260)).max(6).default([]),
});

export type CurriculumAiDraftSummary = z.infer<typeof CurriculumAiDraftSummarySchema>;

type CurriculumJsonNode = string | string[] | { [key: string]: CurriculumJsonNode };

export const CurriculumAiDocumentNodeSchema: z.ZodType<CurriculumJsonNode> = z.lazy(() =>
  z.union([
    z.string().trim().min(1).max(240),
    z.array(z.string().trim().min(1).max(240)).min(1).max(16),
    z.record(z.string().trim().min(1).max(180), CurriculumAiDocumentNodeSchema),
  ]),
);

export const CurriculumAiLessonSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(600),
  subject: z.string().trim().min(1).max(80).optional(),
  estimatedMinutes: z.number().int().positive().max(240).optional(),
  materials: z.array(z.string().trim().min(1).max(180)).max(12).default([]),
  objectives: z.array(z.string().trim().min(1).max(220)).max(8).default([]),
  linkedSkillTitles: z.array(z.string().trim().min(1).max(180)).max(8).default([]),
});

export type CurriculumAiLesson = z.infer<typeof CurriculumAiLessonSchema>;

export const CurriculumAiUnitSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(700),
  estimatedWeeks: z.number().positive().max(52).optional(),
  lessons: z.array(CurriculumAiLessonSchema).min(1).max(12),
});

export type CurriculumAiUnit = z.infer<typeof CurriculumAiUnitSchema>;

export const CurriculumAiGeneratedArtifactSchema = z.object({
  source: CurriculumAiDraftSummarySchema,
  intakeSummary: z.string().trim().min(1).max(1_500),
  document: z.record(z.string().trim().min(1).max(180), CurriculumAiDocumentNodeSchema),
  units: z.array(CurriculumAiUnitSchema).min(1).max(16),
});

export type CurriculumAiGeneratedArtifact = z.infer<typeof CurriculumAiGeneratedArtifactSchema>;

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
});

export type CurriculumAiCreateResponse = z.infer<typeof CurriculumAiCreateResponseSchema>;
