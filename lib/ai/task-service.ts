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
import { resolvePrompt } from "@/lib/prompts/store";
import type { AiTaskName, CopilotContext, ArtifactLineage, GenerationJob } from "./types";
import type { ChatMessage } from "./types";

// ---------------------------------------------------------------------------
// Task input/output types
// ---------------------------------------------------------------------------

export interface LessonDraftInput {
  title?: string;
  topic: string;
  gradeLevel?: string;
  standardIds?: string[];
  estimatedMinutes?: number;
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

// ---------------------------------------------------------------------------
// Inline tasks (short-running)
// ---------------------------------------------------------------------------

export async function summarizeText(
  input: SummarizeInput
): Promise<TaskResult<string>> {
  const adapter = getAdapterForTask("text.summarize");
  const prompt = resolvePrompt("text.summarize");

  const result = await adapter.complete({
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
    lineage: buildLineage("text.summarize", adapter.providerId),
  };
}

export async function suggestStandardsWithAI(
  input: StandardsSuggestInput
): Promise<TaskResult<string[]>> {
  const adapter = getAdapterForTask("standards.suggest");
  const prompt = resolvePrompt("standards.suggest");

  const result = await adapter.completeJson<{ standardIds: string[] }>({
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
    lineage: buildLineage("standards.suggest", adapter.providerId),
  };
}

export async function answerChatMessage(
  input: ChatAnswerInput
): Promise<TaskResult<string>> {
  const adapter = getAdapterForTask("chat.answer");
  const prompt = resolvePrompt("chat.answer");

  const systemWithContext = input.context
    ? `${prompt.systemPrompt}\n\nContext:\n${JSON.stringify(input.context, null, 2)}`
    : prompt.systemPrompt;

  const result = await adapter.complete({
    messages: [
      { role: "system", content: systemWithContext },
      ...input.messages,
    ],
  });

  return {
    output: result.content,
    lineage: buildLineage("chat.answer", adapter.providerId),
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
  const job = buildJob("lesson.draft", input);
  await sendGenerationJob(job);
  return job;
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
  const adapter = getAdapterForTask("chat.answer");
  const prompt = resolvePrompt("chat.answer");

  const systemWithContext = input.context
    ? `${prompt.systemPrompt}\n\nContext:\n${JSON.stringify(input.context, null, 2)}`
    : prompt.systemPrompt;

  for await (const chunk of adapter.stream({
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

function buildLineage(taskName: AiTaskName, providerId: string): ArtifactLineage {
  return {
    id: randomUUID(),
    taskName,
    promptRef: { task: taskName, version: "1.0.0" },
    providerId: providerId as import("./types").ProviderId,
    modelId: "mock-model-1",
    inputHash: "stub",
    createdAt: new Date().toISOString(),
  };
}

function buildJob(
  taskName: AiTaskName,
  inputs: unknown
): GenerationJob {
  return {
    jobId: randomUUID(),
    taskName,
    inputs,
    promptRef: { task: taskName, version: "1.0.0" },
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
