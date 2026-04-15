import "@/lib/server-only";

import { z } from "zod";

import { ActivitySpecSchema } from "@/lib/activities/spec";
import { validateActivitySpec } from "@/lib/activities/validation";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import type { PlanItem } from "@/lib/planning/types";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation, previewLearningCoreOperation } from "./operations";

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

function buildPlanItemFeedbackNotes(planItems: PlanItem[]) {
  return uniqueStrings(
    planItems.flatMap((item) => {
      const evaluation = item.latestEvaluation;
      if (!evaluation) {
        return [];
      }

      const summary = evaluation.note?.trim().length
        ? `${item.title}: ${evaluation.label}. ${evaluation.note.trim()}`
        : `${item.title}: ${evaluation.label}.`;

      return [summary];
    }),
  );
}

function buildRecentLessonOutcomes(planItems: PlanItem[]) {
  return planItems
    .filter((item) => item.latestEvaluation)
    .slice(0, 5)
    .map((item) => ({
      title: item.title,
      status: item.latestEvaluation!.label,
      date: item.latestEvaluation!.createdAt.slice(0, 10),
    }));
}

export function buildLearningCoreActivityGenerateInput(
  params: BuildLearningCoreActivityInputParams,
) {
  const planItems = params.planItems ?? [];
  const feedbackNotes = buildPlanItemFeedbackNotes(planItems);
  const recentLessonOutcomes = buildRecentLessonOutcomes(planItems);

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
    feedback_notes: feedbackNotes,
    recent_lesson_outcomes: recentLessonOutcomes,
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
  return previewLearningCoreOperation(
    "activity_generate",
    buildLearningCoreEnvelope({
      input: buildLearningCoreActivityGenerateInput(params),
      surface: "today_workspace",
      lessonSessionId: params.lessonSessionId ?? null,
      planItemIds: (params.planItems ?? []).map((item) => item.id),
      workflowMode: params.workflowMode ?? null,
      requestOrigin: "server_action",
      debug: true,
      presentationContext: {
        audience: "internal",
        displayIntent: "preview",
        shouldReturnPromptPreview: true,
      },
    }),
  );
}

export async function generateLessonDraftActivitySpec(
  params: BuildLearningCoreActivityInputParams,
) {
  const parsed = await executeLearningCoreOperation(
    "activity_generate",
    buildLearningCoreEnvelope({
      input: buildLearningCoreActivityGenerateInput(params),
      surface: "today_workspace",
      lessonSessionId: params.lessonSessionId ?? null,
      planItemIds: (params.planItems ?? []).map((item) => item.id),
      workflowMode: params.workflowMode ?? null,
      requestOrigin: "server_action",
      presentationContext: {
        audience: "parent",
        displayIntent: "final",
      },
    }),
    ActivitySpecSchema,
  );
  assertStrictActivityArtifact(parsed.artifact);
  return parsed;
}
