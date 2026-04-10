import { z } from "zod";
import { InteractiveWidgetPayloadSchema } from "./widgets";

export const ActivityComponentFeedbackStatusSchema = z.enum([
  "correct",
  "incorrect",
  "partial",
  "needs_review",
]);
export type ActivityComponentFeedbackStatus = z.infer<typeof ActivityComponentFeedbackStatusSchema>;

export const ActivityComponentFeedbackScoringSchema = z.object({
  score: z.number().min(0).max(1).optional(),
  matchedTargets: z.number().int().nonnegative().optional(),
  totalTargets: z.number().int().nonnegative().optional(),
  rubricNotes: z.string().optional(),
});
export type ActivityComponentFeedbackScoring = z.infer<typeof ActivityComponentFeedbackScoringSchema>;

export const ActivityComponentFeedbackSchema = z.object({
  schemaVersion: z.literal("1"),
  componentId: z.string(),
  componentType: z.string(),
  widgetEngineKind: z.string().optional(),
  status: ActivityComponentFeedbackStatusSchema,
  feedbackMessage: z.string(),
  hint: z.string().optional(),
  nextStep: z.string().optional(),
  confidence: z.number().min(0).max(1),
  allowRetry: z.boolean(),
  evaluationMethod: z.enum(["deterministic", "llm"]),
  scoring: ActivityComponentFeedbackScoringSchema.optional(),
});
export type ActivityComponentFeedback = z.infer<typeof ActivityComponentFeedbackSchema>;

export const RequestActivityComponentFeedbackSchema = z.object({
  componentId: z.string().min(1),
  componentType: z.string().min(1),
  widget: InteractiveWidgetPayloadSchema.optional(),
  learnerResponse: z.unknown(),
  timeSpentMs: z.number().int().nonnegative().optional(),
});
export type RequestActivityComponentFeedback = z.infer<typeof RequestActivityComponentFeedbackSchema>;
