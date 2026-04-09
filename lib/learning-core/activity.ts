import "@/lib/server-only";

import { z } from "zod";

import { ActivitySpecSchema } from "@/lib/activities/spec";
import { validateActivitySpec } from "@/lib/activities/validation";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import type { PlanItem } from "@/lib/planning/types";

import { postLearningCore } from "./client";

const LearningCorePromptPreviewSchema = z.object({
  system_prompt: z.string().min(1),
  user_prompt: z.string().min(1),
});

const LearningCoreLineageSchema = z.object({
  operation_name: z.string().min(1),
  skill_name: z.string().min(1),
  skill_version: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  executed_at: z.string().min(1),
});

const LearningCoreTraceSchema = z.object({
  request_id: z.string().min(1),
  operation_name: z.string().min(1),
  allowed_tools: z.array(z.string()),
  prompt_preview: LearningCorePromptPreviewSchema,
  executed_at: z.string().min(1),
});

const LearningCoreActivityExecuteResponseSchema = z.object({
  artifact: ActivitySpecSchema,
  lineage: LearningCoreLineageSchema,
  trace: LearningCoreTraceSchema,
});

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

export interface BuildLearningCoreActivityInputParams {
  lessonDraft: StructuredLessonDraft;
  learnerName: string;
  learnerGradeLevel?: string;
  workflowMode?: string;
  planItems?: PlanItem[];
  lessonSessionId?: string | null;
  leadPlanItemId?: string | null;
}

export function buildLearningCoreActivityGenerateInput(
  params: BuildLearningCoreActivityInputParams,
) {
  const planItems = params.planItems ?? [];

  return {
    learner_name: params.learnerName,
    learner_grade_level: params.learnerGradeLevel ?? null,
    workflow_mode: params.workflowMode ?? null,
    subject: uniqueStrings(planItems.map((item) => item.subject))[0] ?? null,
    source_title: planItems[0]?.sourceLabel ?? null,
    lesson_session_id: params.lessonSessionId ?? null,
    lead_plan_item_id: params.leadPlanItemId ?? null,
    plan_item_ids: planItems.map((item) => item.id),
    linked_skill_titles: uniqueStrings(planItems.map((item) => item.title)),
    linked_objective_ids: [],
    standard_ids: uniqueStrings(planItems.flatMap((item) => item.standards ?? [])),
    lesson_draft: params.lessonDraft,
  };
}

function assertStrictActivityArtifact(value: z.infer<typeof ActivitySpecSchema>) {
  const validation = validateActivitySpec(value);

  if (!validation.valid || validation.warnings.length > 0) {
    const details = [
      ...validation.errors.map((error) => `error: ${error}`),
      ...validation.warnings.map((warning) => `warning: ${warning}`),
    ].join("; ");

    throw new Error(`learning-core returned an invalid ActivitySpec: ${details}`);
  }
}

export async function previewLessonDraftActivityPrompt(
  params: BuildLearningCoreActivityInputParams,
) {
  const payload = await postLearningCore(
    "/v1/operations/generate-activities-from-plan-session/prompt-preview",
    {
      input: buildLearningCoreActivityGenerateInput(params),
    },
  );

  const parsed = LearningCorePromptPreviewSchema.parse(payload);
  return {
    systemPrompt: parsed.system_prompt,
    userPrompt: parsed.user_prompt,
  };
}

export async function generateLessonDraftActivitySpec(
  params: BuildLearningCoreActivityInputParams,
) {
  const payload = await postLearningCore(
    "/v1/operations/generate-activities-from-plan-session/execute",
    {
      input: buildLearningCoreActivityGenerateInput(params),
    },
  );

  const parsed = LearningCoreActivityExecuteResponseSchema.parse(payload);
  assertStrictActivityArtifact(parsed.artifact);
  return parsed;
}

