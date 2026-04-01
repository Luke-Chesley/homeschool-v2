/**
 * AI task service — the main entry point for all AI operations.
 *
 * Each task is a named, typed operation. Inputs are validated, prompts are
 * resolved from the prompt store, and outputs are returned with lineage info.
 *
 * Async tasks (lesson.draft, worksheet.generate, interactive.generate,
 * plan.adapt) are modeled for Inngest dispatch. Short tasks (standards.suggest,
 * text.summarize, chat.answer) can run inline.
 */

import { randomUUID } from "crypto";
import { getAdapterForTask } from "./registry";
import { getModelForTask } from "./provider-adapter";
import { getAiRoutingConfig } from "./routing";
import { resolvePrompt } from "@/lib/prompts/store";
import {
  buildLessonDraftUserPrompt,
  LESSON_DRAFT_PROMPT_VERSION,
} from "@/lib/prompts/lesson-draft";
import type { AiTaskName, CopilotContext, ArtifactLineage, GenerationJob } from "./types";
import type { ChatMessage } from "./types";
import { z } from "zod";

const StandardsSuggestOutputSchema = z.object({
  standardIds: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Task input/output types
// ---------------------------------------------------------------------------

export interface LessonDraftInput {
  title?: string;
  topic: string;
  gradeLevel?: string;
  standardIds?: string[];
  estimatedMinutes?: number;
  objectives?: string[];
  routeItems?: Array<{
    title: string;
    subject: string;
    estimatedMinutes: number;
    objective: string;
    lessonLabel: string;
    note?: string;
  }>;
  materials?: string[];
  context?: CopilotContext;
}

export interface WorksheetInput {
  topic: string;
  gradeLevel?: string;
  standardIds?: string[];
  questionCount?: number;
  context?: CopilotContext;
}

export interface InteractiveInput {
  topic: string;
  kind?: "quiz" | "flashcards" | "matching" | "sequencing";
  gradeLevel?: string;
  standardIds?: string[];
  context?: CopilotContext;
}

export interface SummarizeInput {
  text: string;
  maxLength?: number;
}

export interface StandardsSuggestInput {
  objectiveText: string;
  frameworkId?: string;
  gradeLevel?: string;
  subject?: string;
}

export interface PlanAdaptInput {
  learnerId: string;
  recentOutcomes: Array<{ title: string; status: string; date: string }>;
  currentPlan: string;
  context?: CopilotContext;
}

export interface ChatAnswerInput {
  messages: ChatMessage[];
  context?: CopilotContext;
}

export interface TaskResult<T = unknown> {
  output: T;
  lineage: ArtifactLineage;
}

export interface PromptPreview {
  systemPrompt: string;
  userPrompt: string;
}

// ---------------------------------------------------------------------------
// Inline tasks (short-running)
// ---------------------------------------------------------------------------

export async function summarizeText(
  input: SummarizeInput
): Promise<TaskResult<string>> {
  const { adapter, model } = getTaskRuntime("text.summarize");
  const prompt = resolvePrompt("text.summarize");

  const result = await adapter.complete({
    model,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      {
        role: "user",
        content: `Summarize the following text in ${input.maxLength ?? 150} words or fewer:\n\n${input.text}`,
      },
    ],
  });

  return {
    output: result.content,
    lineage: buildLineage("text.summarize", adapter.providerId, result.model ?? model),
  };
}

export async function suggestStandardsWithAI(
  input: StandardsSuggestInput
): Promise<TaskResult<string[]>> {
  const { adapter, model } = getTaskRuntime("standards.suggest");
  const prompt = resolvePrompt("standards.suggest");

  const result = await adapter.completeJson<{ standardIds: string[] }>({
    model,
    outputSchema: StandardsSuggestOutputSchema,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      {
        role: "user",
        content: `Suggest the most relevant standards for this learning objective:\n"${input.objectiveText}"\nFramework: ${input.frameworkId ?? "CCSS"}, Grade: ${input.gradeLevel ?? "4"}`,
      },
    ],
  });

  return {
    output: result?.standardIds ?? [],
    lineage: buildLineage("standards.suggest", adapter.providerId, model),
  };
}

export async function answerChatMessage(
  input: ChatAnswerInput
): Promise<TaskResult<string>> {
  const { adapter, model } = getTaskRuntime("chat.answer");
  const prompt = resolvePrompt("chat.answer");

  const systemWithContext = input.context
    ? `${prompt.systemPrompt}\n\nContext:\n${JSON.stringify(input.context, null, 2)}`
    : prompt.systemPrompt;

  const result = await adapter.complete({
    model,
    messages: [
      { role: "system", content: systemWithContext },
      ...input.messages,
    ],
  });

  return {
    output: result.content,
    lineage: buildLineage("chat.answer", adapter.providerId, result.model ?? model),
  };
}

// ---------------------------------------------------------------------------
// Async tasks — dispatch as Inngest jobs
// ---------------------------------------------------------------------------

/**
 * Dispatch a lesson draft generation job.
 *
 * Integration point: replace stub with `inngest.send("ai/generation.requested", job)`
 */
export async function dispatchLessonDraft(input: LessonDraftInput): Promise<GenerationJob> {
  const job = buildJob("lesson.draft", input, LESSON_DRAFT_PROMPT_VERSION);
  await sendGenerationJob(job);
  return job;
}

export function buildLessonDraftPromptPreview(input: LessonDraftInput): PromptPreview {
  const prompt = resolvePrompt("lesson.draft", LESSON_DRAFT_PROMPT_VERSION);
  const routeItems = input.routeItems ?? [];
  const objectives = input.objectives ?? [];
  const totalMinutes = input.estimatedMinutes ?? routeItems.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  const userPrompt = `${buildLessonDraftUserPrompt({
    learnerName: input.context?.learnerName ?? "the learner",
    sourceTitle: input.title ?? input.topic,
    dateLabel: input.context?.dailyWorkspaceSnapshot?.date ?? "today",
    weekLabel: input.context?.weeklyPlanningSnapshot?.weekLabel,
    itemCount: routeItems.length,
    totalMinutes,
    objectiveCount: objectives.length,
    objectives,
    routeItems: routeItems.map((item) => ({
      title: item.title,
      subject: item.subject,
      estimatedMinutes: item.estimatedMinutes,
      objective: item.objective,
      lessonLabel: item.lessonLabel,
      note: item.note,
    })),
    materials: input.materials ?? [],
    weekHighlights: input.context?.weeklyPlanningSnapshot?.highlights ?? [],
    weekScheduleSummary:
      input.context?.weeklyPlanningSnapshot?.days.map(
        (day) =>
          `${day.label}: ${
            day.itemTitles.length > 0 ? day.itemTitles.join(", ") : "No scheduled items"
          }`,
      ) ?? [],
  })}

Context:
${input.context ? JSON.stringify(input.context, null, 2) : "No additional context provided."}`;

  return {
    systemPrompt: prompt.systemPrompt,
    userPrompt,
  };
}

export async function generateLessonDraft(
  input: LessonDraftInput,
): Promise<TaskResult<string>> {
  const { adapter, model } = getTaskRuntime("lesson.draft");
  const promptPreview = buildLessonDraftPromptPreview(input);

  const result = await adapter.complete({
    model,
    messages: [
      { role: "system", content: promptPreview.systemPrompt },
      {
        role: "user",
        content: promptPreview.userPrompt,
      },
    ],
  });

  return {
    output: result.content,
    lineage: buildLineage(
      "lesson.draft",
      adapter.providerId,
      result.model ?? model,
      LESSON_DRAFT_PROMPT_VERSION,
    ),
  };
}

export async function dispatchWorksheetGeneration(input: WorksheetInput): Promise<GenerationJob> {
  const job = buildJob("worksheet.generate", input);
  await sendGenerationJob(job);
  return job;
}

export async function dispatchInteractiveGeneration(input: InteractiveInput): Promise<GenerationJob> {
  const job = buildJob("interactive.generate", input);
  await sendGenerationJob(job);
  return job;
}

export async function dispatchPlanAdaptation(input: PlanAdaptInput): Promise<GenerationJob> {
  const job = buildJob("plan.adapt", input);
  await sendGenerationJob(job);
  return job;
}

// ---------------------------------------------------------------------------
// Streaming chat (used by the route handler for Server-Sent Events)
// ---------------------------------------------------------------------------

export async function* streamChatAnswer(
  input: ChatAnswerInput
): AsyncIterable<string> {
  const { adapter, model } = getTaskRuntime("chat.answer");
  const prompt = resolvePrompt("chat.answer");

  const systemWithContext = input.context
    ? `${prompt.systemPrompt}\n\nContext:\n${JSON.stringify(input.context, null, 2)}`
    : prompt.systemPrompt;

  for await (const chunk of adapter.stream({
    model,
    messages: [
      { role: "system", content: systemWithContext },
      ...input.messages,
    ],
  })) {
    if (chunk.delta) yield chunk.delta;
    if (chunk.done) break;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLineage(
  taskName: AiTaskName,
  providerId: string,
  modelId: string,
  promptVersion = "1.0.0",
): ArtifactLineage {
  return {
    id: randomUUID(),
    taskName,
    promptRef: { task: taskName, version: promptVersion },
    providerId: providerId as import("./types").ProviderId,
    modelId,
    inputHash: "stub",
    createdAt: new Date().toISOString(),
  };
}

function getTaskRuntime(taskName: AiTaskName) {
  const routing = getAiRoutingConfig();

  return {
    adapter: getAdapterForTask(taskName),
    model: getModelForTask(taskName, routing),
  };
}

function buildJob(
  taskName: AiTaskName,
  inputs: unknown,
  promptVersion = "1.0.0",
): GenerationJob {
  return {
    jobId: randomUUID(),
    taskName,
    inputs,
    promptRef: { task: taskName, version: promptVersion },
    requestedAt: new Date().toISOString(),
  };
}

async function sendGenerationJob(job: GenerationJob): Promise<void> {
  // Integration point: inngest.send("ai/generation.requested", { data: job })
  console.info("[ai/task-service] Generation job dispatched (stub)", {
    jobId: job.jobId,
    taskName: job.taskName,
  });
}
