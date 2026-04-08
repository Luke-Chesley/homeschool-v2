import "@/lib/server-only";

import { createHash, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { parseActivityDefinition } from "@/lib/activities/types";
import {
  createCurriculumSourceFromAiDraftArtifact,
  setLiveCurriculumSource,
} from "@/lib/curriculum/service";
import { generateCurriculumArtifact } from "@/lib/curriculum/ai-draft-service";
import { getRepositories } from "@/lib/db";
import { ensureDatabaseReady, getDb } from "@/lib/db/server";
import { organizations } from "@/lib/db/schema";
import type { HomeschoolCurriculumGenerationJobInput } from "@/lib/homeschool/onboarding/service";
import { recordHomeschoolAuditEvent } from "@/lib/homeschool/reporting/service";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import {
  validateLessonDraft,
  hasProsyContent,
  buildCorrectionNotes,
} from "@/lib/lesson-draft/validate";
import { getTodayWorkspace } from "@/lib/planning/today-service";
import { getOrCreateWeeklyRouteBoardForLearner } from "@/lib/planning/weekly-route-service";
import { trackProductEvent } from "@/lib/platform/observability";
import {
  buildLessonDraftUserPrompt,
  LESSON_DRAFT_PROMPT_VERSION,
} from "@/lib/prompts/lesson-draft";
import { resolvePrompt } from "@/lib/prompts/store";

import { getAdapterForTask } from "./registry";
import { getModelForTask } from "./provider-adapter";
import { getAiRoutingConfig } from "./routing";
import type { AiTaskName, ArtifactLineage, ChatMessage, CopilotContext, GenerationJob } from "./types";

const StandardsSuggestOutputSchema = z.object({
  standardIds: z.array(z.string()),
});

/**
 * Resolved timing for this lesson draft session.
 * Always use resolvedTotalMinutes as the lesson budget.
 * Do not compute lesson budget by summing routeItems[*].estimatedMinutes.
 */
export interface LessonDraftResolvedTiming {
  /** Canonical session budget — the authoritative total for this draft. */
  resolvedTotalMinutes: number;
  /** Source-level pacing sessionMinutes, if present. */
  sourceSessionMinutes: number | undefined;
  /** Explicit per-lesson override, if any. */
  lessonOverrideMinutes: number | undefined;
  /** What produced the resolved value. */
  timingSource: "lesson_override" | "source_default" | "system_fallback";
}

export interface LessonDraftInput {
  title?: string;
  topic: string;
  gradeLevel?: string;
  standardIds?: string[];
  /**
   * @deprecated Pass resolvedTiming instead. This field is only used as a
   * fallback when resolvedTiming is absent (e.g. callers that have not yet
   * been updated). Do NOT compute this by summing routeItems[*].estimatedMinutes.
   */
  estimatedMinutes?: number;
  /**
   * Explicit resolved timing contract for this lesson draft.
   * When present, resolvedTiming.resolvedTotalMinutes is used as the session
   * budget and estimatedMinutes is ignored.
   */
  resolvedTiming?: LessonDraftResolvedTiming;
  objectives?: string[];
  routeItems?: Array<{
    title: string;
    subject: string;
    /** Item-level effort hint — NOT the session budget. */
    estimatedMinutes: number;
    objective: string;
    lessonLabel: string;
    note?: string;
  }>;
  materials?: string[];
  /** Optional lesson shape meta-template to guide block selection */
  lessonShape?: import("@/lib/lesson-draft/types").LessonShape;
  /** Optional teacher/parent context to tune generated content */
  teacherContext?: import("@/lib/lesson-draft/types").TeacherContext;
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
  usage?: { promptTokens: number; completionTokens: number };
}

export interface PromptPreview {
  systemPrompt: string;
  userPrompt: string;
}

export interface DispatchTaskOptions {
  organizationId: string;
  learnerId?: string | null;
  requestedByAdultUserId?: string | null;
  planItemId?: string | null;
  lessonSessionId?: string | null;
  artifactTitle?: string | null;
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildLineage(
  taskName: AiTaskName,
  providerId: string,
  modelId: string,
  promptVersion = "1.0.0",
  artifactId?: string,
): ArtifactLineage {
  return {
    id: randomUUID(),
    taskName,
    promptRef: { task: taskName, version: promptVersion },
    providerId: providerId as ArtifactLineage["providerId"],
    modelId,
    inputHash: stableHash({ taskName, promptVersion, modelId, artifactId }),
    createdAt: new Date().toISOString(),
    artifactId,
  };
}

function getTaskRuntime(taskName: AiTaskName) {
  const routing = getAiRoutingConfig();

  return {
    adapter: getAdapterForTask(taskName),
    model: getModelForTask(taskName, routing),
  };
}

function queueJobProcessing(jobId: string) {
  setTimeout(() => {
    void processAiGenerationJob(jobId).catch((error) => {
      console.error("[ai/task-service] queued job failed", { jobId, error });
    });
  }, 0);
}

function getArtifactTypeForTask(taskName: AiTaskName) {
  switch (taskName) {
    case "lesson.draft":
      return "lesson_plan" as const;
    case "worksheet.generate":
      return "worksheet" as const;
    case "interactive.generate":
      return "interactive_blueprint" as const;
    default:
      return null;
  }
}

function getInteractiveActivityType(kind: string) {
  switch (kind) {
    case "quiz":
    case "matching":
    case "flashcards":
    case "sequencing":
    case "guided_practice":
    case "reflection":
    case "reading_check":
    case "simulation":
      return kind;
    default:
      return "guided_practice";
  }
}

function buildWorksheetPrompt(input: WorksheetInput) {
  return `Generate a printable worksheet for ${input.topic}.

Grade level: ${input.gradeLevel ?? "general"}
Question count: ${input.questionCount ?? 8}
Standards: ${(input.standardIds ?? []).join(", ") || "none provided"}

Return markdown with a clear title, instructions, and the full worksheet content.`;
}

function buildPlanAdaptPrompt(input: PlanAdaptInput) {
  return `Review the recent outcomes and suggest the next plan adjustment.

Current plan:
${input.currentPlan}

Recent outcomes:
${input.recentOutcomes.map((item) => `- ${item.date}: ${item.title} (${item.status})`).join("\n")}`;
}

function buildInteractiveFallback(input: InteractiveInput) {
  switch (input.kind ?? "quiz") {
    case "flashcards":
      return {
        kind: "flashcards",
        title: `${input.topic} flashcards`,
        cards: [
          { prompt: input.topic, answer: "Key idea" },
          { prompt: "Definition", answer: `Explain ${input.topic}` },
        ],
      };
    case "matching":
      return {
        kind: "matching",
        title: `${input.topic} matching`,
        leftItems: ["Term 1", "Term 2"],
        rightItems: ["Meaning 1", "Meaning 2"],
        pairs: [
          { left: 0, right: 0 },
          { left: 1, right: 1 },
        ],
      };
    case "sequencing":
      return {
        kind: "sequencing",
        title: `${input.topic} sequence`,
        prompt: `Place the steps for ${input.topic} in order.`,
        items: ["First", "Next", "Then", "Finally"],
        correctOrder: [0, 1, 2, 3],
      };
    default:
      return {
        kind: "quiz",
        title: `${input.topic} check-in`,
        questions: [
          {
            id: "q1",
            prompt: `Which statement best matches ${input.topic}?`,
            choices: ["Option A", "Option B", "Option C"],
            answerIndex: 0,
          },
        ],
      };
  }
}

async function createArtifactShell(params: {
  organizationId: string;
  learnerId?: string | null;
  planItemId?: string | null;
  lessonSessionId?: string | null;
  taskName: AiTaskName;
  title: string;
}) {
  const artifactType = getArtifactTypeForTask(params.taskName);
  if (!artifactType) {
    return null;
  }

  return getRepositories().activities.createArtifact({
    organizationId: params.organizationId,
    learnerId: params.learnerId ?? null,
    planItemId: params.planItemId ?? null,
    lessonSessionId: params.lessonSessionId ?? null,
    artifactType,
    title: params.title,
    status: "queued",
    body: null,
    promptVersion: null,
    promptTemplateId: null,
    generationJobId: null,
    storagePath: null,
    providerId: null,
    modelId: null,
    inputHash: null,
    lineageParentId: null,
    supersededByArtifactId: null,
    approvedAt: null,
    archivedAt: null,
    sourceContext: {},
    qaMetadata: {},
    costMetadata: {},
    metadata: {
      source: "ai-dispatch",
      taskName: params.taskName,
    },
  });
}

async function dispatchGenerationJob(
  taskName: AiTaskName,
  inputs: unknown,
  options: DispatchTaskOptions,
): Promise<GenerationJob & { artifactId?: string | null }> {
  await ensureDatabaseReady();
  const repos = getRepositories();
  const prompt = await resolvePrompt(taskName);
  const runtime = getTaskRuntime(taskName);
  const artifact = await createArtifactShell({
    organizationId: options.organizationId,
    learnerId: options.learnerId,
    planItemId: options.planItemId,
    lessonSessionId: options.lessonSessionId,
    taskName,
    title: options.artifactTitle ?? `${taskName} artifact`,
  });

  const jobRecord = await repos.aiPlatform.createJob({
    organizationId: options.organizationId,
    learnerId: options.learnerId ?? null,
    planItemId: options.planItemId ?? null,
    lessonSessionId: options.lessonSessionId ?? null,
    requestedByAdultUserId: options.requestedByAdultUserId ?? null,
    promptTemplateId: prompt.id ?? null,
    artifactId: artifact?.id ?? null,
    taskName,
    status: "queued",
    providerId: runtime.adapter.providerId,
    modelId: runtime.model,
    promptVersion: prompt.version,
    inputHash: stableHash(inputs),
    inputs: (inputs ?? {}) as Record<string, unknown>,
    output: {},
    errorMessage: null,
    attempts: 0,
    requestedAt: new Date(),
    startedAt: null,
    completedAt: null,
    metadata: {},
  });

  if (artifact) {
    await repos.activities.updateArtifact(artifact.id, {
      generationJobId: jobRecord.id,
      promptVersion: prompt.version,
      inputHash: stableHash(inputs),
      providerId: runtime.adapter.providerId,
      modelId: runtime.model,
    });
  }

  queueJobProcessing(jobRecord.id);

  return {
    jobId: jobRecord.id,
    taskName,
    inputs,
    promptRef: { task: taskName, version: prompt.version },
    providerId: runtime.adapter.providerId as GenerationJob["providerId"],
    requestedAt: jobRecord.requestedAt.toISOString(),
    artifactId: artifact?.id ?? null,
  };
}

export async function summarizeText(input: SummarizeInput): Promise<TaskResult<string>> {
  const { adapter, model } = getTaskRuntime("text.summarize");
  const prompt = await resolvePrompt("text.summarize");

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
    lineage: buildLineage("text.summarize", adapter.providerId, result.model ?? model, prompt.version),
    usage: result.usage,
  };
}

export async function suggestStandardsWithAI(
  input: StandardsSuggestInput,
): Promise<TaskResult<string[]>> {
  const { adapter, model } = getTaskRuntime("standards.suggest");
  const prompt = await resolvePrompt("standards.suggest");

  const result = await adapter.completeJson<{ standardIds: string[] }>({
    model,
    outputSchema: StandardsSuggestOutputSchema,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      {
        role: "user",
        content: `Suggest the most relevant objectives for:\n"${input.objectiveText}"\nFramework: ${input.frameworkId ?? "default"}\nGrade: ${input.gradeLevel ?? "n/a"}\nSubject: ${input.subject ?? "n/a"}`,
      },
    ],
  });

  return {
    output: result?.standardIds ?? [],
    lineage: buildLineage("standards.suggest", adapter.providerId, model, prompt.version),
  };
}

export async function answerChatMessage(input: ChatAnswerInput): Promise<TaskResult<string>> {
  const { adapter, model } = getTaskRuntime("chat.answer");
  const prompt = await resolvePrompt("chat.answer");

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
    lineage: buildLineage("chat.answer", adapter.providerId, result.model ?? model, prompt.version),
    usage: result.usage,
  };
}

export async function buildLessonDraftPromptPreview(
  input: LessonDraftInput,
): Promise<PromptPreview> {
  const prompt = await resolvePrompt("lesson.draft", LESSON_DRAFT_PROMPT_VERSION);
  const routeItems = input.routeItems ?? [];
  const objectives = input.objectives ?? [];
  // Prefer resolvedTiming.resolvedTotalMinutes (canonical session budget from curriculum pacing).
  // Fall back to estimatedMinutes if provided (legacy callers only).
  // Do NOT fall back to summing routeItems[*].estimatedMinutes — that conflates
  // per-item effort with the session budget and produces inflated totals.
  const totalMinutes =
    input.resolvedTiming?.resolvedTotalMinutes ??
    input.estimatedMinutes ??
    45; // final fallback — only reached when no timing contract exists

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
    lessonShape: input.lessonShape,
    teacherContext: input.teacherContext,
  })}\n\nContext:\n${input.context ? JSON.stringify(input.context, null, 2) : "No additional context provided."}`;

  return {
    systemPrompt: prompt.systemPrompt,
    userPrompt,
  };
}

const MAX_LESSON_DRAFT_RETRIES = 2;

export async function generateLessonDraft(
  input: LessonDraftInput,
): Promise<TaskResult<StructuredLessonDraft>> {
  const { adapter, model } = getTaskRuntime("lesson.draft");
  const prompt = await buildLessonDraftPromptPreview(input);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: prompt.systemPrompt },
    { role: "user", content: prompt.userPrompt },
  ];

  let lastRaw: Record<string, unknown> = {};
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= MAX_LESSON_DRAFT_RETRIES; attempt++) {
    if (attempt > 0) {
      // Inject correction turn
      const correctionNote = buildCorrectionNotes(
        lastErrors,
        Array.isArray(lastRaw.blocks) ? hasProsyContent(lastRaw as unknown as StructuredLessonDraft) : false,
      );
      messages.push({ role: "assistant", content: JSON.stringify(lastRaw) });
      messages.push({ role: "user", content: correctionNote });
    }

    const result = await adapter.completeJson<Record<string, unknown>>({
      model,
      messages,
      maxTokens: 8000,
    });

    lastRaw = result ?? {};

    const validation = validateLessonDraft(lastRaw);
    if (validation.valid) {
      const draft = validation.draft;
      const proseWarning = hasProsyContent(draft);
      if (!proseWarning || attempt >= MAX_LESSON_DRAFT_RETRIES) {
        return {
          output: draft,
          lineage: buildLineage(
            "lesson.draft",
            adapter.providerId,
            model,
            LESSON_DRAFT_PROMPT_VERSION,
          ),
        };
      }
      // Valid schema but too prosy — retry with prose warning
      lastErrors = [];
    } else {
      lastErrors = validation.errors;
      if (attempt >= MAX_LESSON_DRAFT_RETRIES) {
        throw new Error(
          `Lesson draft failed validation after ${attempt + 1} attempt(s): ${lastErrors.join("; ")}`,
        );
      }
    }
  }

  // Unreachable, but TypeScript requires a return
  throw new Error("Lesson draft generation failed unexpectedly.");
}

export async function generateWorksheet(
  input: WorksheetInput,
): Promise<TaskResult<string>> {
  const { adapter, model } = getTaskRuntime("worksheet.generate");
  const prompt = await resolvePrompt("worksheet.generate");
  const result = await adapter.complete({
    model,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: buildWorksheetPrompt(input) },
    ],
  });

  return {
    output: result.content,
    lineage: buildLineage("worksheet.generate", adapter.providerId, result.model ?? model, prompt.version),
    usage: result.usage,
  };
}

export async function generateInteractive(
  input: InteractiveInput,
): Promise<TaskResult<Record<string, unknown>>> {
  const { adapter, model } = getTaskRuntime("interactive.generate");
  const prompt = await resolvePrompt("interactive.generate");
  const jsonResult = await adapter.completeJson<Record<string, unknown>>({
    model,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      {
        role: "user",
        content: `Generate a ${input.kind ?? "quiz"} activity for ${input.topic}. Return only valid JSON.`,
      },
    ],
  });

  const definition = parseActivityDefinition(jsonResult) ?? buildInteractiveFallback(input);

  return {
    output: definition as Record<string, unknown>,
    lineage: buildLineage("interactive.generate", adapter.providerId, model, prompt.version),
  };
}

export async function generatePlanAdaptation(
  input: PlanAdaptInput,
): Promise<TaskResult<string>> {
  const { adapter, model } = getTaskRuntime("plan.adapt");
  const prompt = await resolvePrompt("plan.adapt");
  const result = await adapter.complete({
    model,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: buildPlanAdaptPrompt(input) },
    ],
  });

  return {
    output: result.content,
    lineage: buildLineage("plan.adapt", adapter.providerId, result.model ?? model, prompt.version),
    usage: result.usage,
  };
}

export async function dispatchLessonDraft(
  input: LessonDraftInput,
  options: DispatchTaskOptions,
) {
  return dispatchGenerationJob("lesson.draft", input, {
    ...options,
    artifactTitle: options.artifactTitle ?? input.title ?? input.topic,
  });
}

export async function dispatchWorksheetGeneration(
  input: WorksheetInput,
  options: DispatchTaskOptions,
) {
  return dispatchGenerationJob("worksheet.generate", input, {
    ...options,
    artifactTitle: options.artifactTitle ?? `${input.topic} worksheet`,
  });
}

export async function dispatchInteractiveGeneration(
  input: InteractiveInput,
  options: DispatchTaskOptions,
) {
  return dispatchGenerationJob("interactive.generate", input, {
    ...options,
    artifactTitle: options.artifactTitle ?? `${input.topic} interactive activity`,
  });
}

export async function dispatchPlanAdaptation(
  input: PlanAdaptInput,
  options: DispatchTaskOptions,
) {
  return dispatchGenerationJob("plan.adapt", input, {
    ...options,
    artifactTitle: options.artifactTitle ?? "Adaptation recommendation",
  });
}

export async function dispatchCurriculumGeneration(
  input: HomeschoolCurriculumGenerationJobInput,
  options: DispatchTaskOptions,
) {
  return dispatchGenerationJob("curriculum.generate", input, {
    ...options,
    artifactTitle: options.artifactTitle ?? "Curriculum generation",
  });
}

export async function getAiGenerationJob(jobId: string) {
  await ensureDatabaseReady();
  return getRepositories().aiPlatform.findJobById(jobId);
}

export async function processAiGenerationJob(jobId: string) {
  await ensureDatabaseReady();
  const repos = getRepositories();
  const job = await repos.aiPlatform.findJobById(jobId);

  if (!job || (job.status !== "queued" && job.status !== "running")) {
    return job;
  }

  if (job.status === "queued") {
    await repos.aiPlatform.updateJob(job.id, {
      status: "running",
      startedAt: new Date(),
      attempts: job.attempts + 1,
    });
  }

  try {
    let output: unknown = null;
    let artifactBody: string | null = null;

    switch (job.taskName as AiTaskName) {
      case "curriculum.generate": {
        const input = job.inputs as unknown as HomeschoolCurriculumGenerationJobInput;
        const generation = await generateCurriculumArtifact({
          learner: input.learner,
          messages: input.messages,
        });

        if (generation.kind === "failure") {
          throw new Error(generation.userSafeMessage);
        }

        const created = await createCurriculumSourceFromAiDraftArtifact({
          householdId: job.organizationId,
          artifact: generation.artifact,
        });
        await setLiveCurriculumSource(job.organizationId, created.sourceId);
        const { weekStartDate } = await getOrCreateWeeklyRouteBoardForLearner({
          learnerId: input.learner.id,
          sourceId: created.sourceId,
        });
        await getTodayWorkspace({
          organizationId: job.organizationId,
          learnerId: input.learner.id,
          learnerName: input.workflow.learnerName,
          date: input.workflow.dailyWorkspaceDate,
        });

        if (input.workflow.kind === "homeschool_onboarding") {
          const db = getDb();
          const organization = await db.query.organizations.findFirst({
            where: (table, { eq }) => eq(table.id, job.organizationId),
          });
          if (organization) {
            const metadata =
              typeof organization.metadata === "object" &&
              organization.metadata !== null &&
              !Array.isArray(organization.metadata)
                ? (organization.metadata as Record<string, unknown>)
                : {};
            const homeschool =
              typeof metadata.homeschool === "object" &&
              metadata.homeschool !== null &&
              !Array.isArray(metadata.homeschool)
                ? (metadata.homeschool as Record<string, unknown>)
                : {};
            const onboarding =
              typeof homeschool.onboarding === "object" &&
              homeschool.onboarding !== null &&
              !Array.isArray(homeschool.onboarding)
                ? (homeschool.onboarding as Record<string, unknown>)
                : {};

            await db
              .update(organizations)
              .set({
                metadata: {
                  ...metadata,
                  homeschool: {
                    ...homeschool,
                    onboarding: {
                      ...onboarding,
                      status: "complete",
                      completedAt: new Date().toISOString(),
                    },
                  },
                },
                updatedAt: new Date(),
              })
              .where(eq(organizations.id, job.organizationId));
          }

          await recordHomeschoolAuditEvent({
            organizationId: job.organizationId,
            learnerId: input.learner.id,
            entityType: "onboarding",
            entityId: created.sourceId,
            eventType: "onboarding.completed",
            summary: `Completed homeschool onboarding for ${input.workflow.householdName ?? "the household"}.`,
            metadata: {
              learnerCount: input.workflow.learnerCount ?? 1,
              curriculumMode: input.workflow.curriculumMode,
              subjects: input.workflow.subjects,
            },
          });
          trackProductEvent({
            name: "homeschool_onboarding_completed",
            organizationId: job.organizationId,
            learnerId: input.learner.id,
            metadata: {
              learnerCount: input.workflow.learnerCount ?? 1,
              curriculumMode: input.workflow.curriculumMode,
            },
          });
        } else {
          await recordHomeschoolAuditEvent({
            organizationId: job.organizationId,
            learnerId: input.learner.id,
            entityType: "curriculum",
            entityId: created.sourceId,
            eventType: "curriculum.created",
            summary: `Created curriculum "${created.sourceTitle}" via async AI decomposition.`,
            metadata: {
              curriculumMode: input.workflow.curriculumMode,
              subjects: input.workflow.subjects,
            },
          });
        }

        output = {
          sourceId: created.sourceId,
          sourceTitle: created.sourceTitle,
          weekStartDate,
          learnerId: input.learner.id,
          redirectTo:
            input.workflow.kind === "homeschool_onboarding"
              ? "/today"
              : `/curriculum/${created.sourceId}`,
        };
        break;
      }
      case "lesson.draft": {
        const result = await generateLessonDraft(job.inputs as unknown as LessonDraftInput);
        output = result.output;
        artifactBody = JSON.stringify(result.output);
        if (job.artifactId) {
          await repos.activities.updateArtifact(job.artifactId, {
            status: "ready",
            body: JSON.stringify(result.output),
            providerId: result.lineage.providerId,
            modelId: result.lineage.modelId,
            promptVersion: result.lineage.promptRef.version,
            inputHash: job.inputHash ?? null,
            qaMetadata: {
              lineageId: result.lineage.id,
            },
            costMetadata: result.usage ?? {},
          });
        }
        break;
      }
      case "worksheet.generate": {
        const result = await generateWorksheet(job.inputs as unknown as WorksheetInput);
        output = result.output;
        artifactBody = result.output;
        if (job.artifactId) {
          await repos.activities.updateArtifact(job.artifactId, {
            status: "ready",
            body: result.output,
            providerId: result.lineage.providerId,
            modelId: result.lineage.modelId,
            promptVersion: result.lineage.promptRef.version,
            inputHash: job.inputHash ?? null,
            qaMetadata: {
              lineageId: result.lineage.id,
            },
            costMetadata: result.usage ?? {},
          });
        }
        break;
      }
      case "interactive.generate": {
        const result = await generateInteractive(job.inputs as unknown as InteractiveInput);
        output = result.output;
        artifactBody = JSON.stringify(result.output, null, 2);
        if (job.artifactId) {
          await repos.activities.updateArtifact(job.artifactId, {
            status: "ready",
            body: artifactBody,
            providerId: result.lineage.providerId,
            modelId: result.lineage.modelId,
            promptVersion: result.lineage.promptRef.version,
            inputHash: job.inputHash ?? null,
            qaMetadata: {
              lineageId: result.lineage.id,
            },
          });
        }

        if (job.organizationId && job.learnerId) {
          const definition = result.output;
          await repos.activities.createActivity({
            organizationId: job.organizationId,
            learnerId: job.learnerId,
            planItemId: job.planItemId ?? null,
            lessonSessionId: job.lessonSessionId ?? null,
            artifactId: job.artifactId ?? null,
            activityType: getInteractiveActivityType(
              typeof definition.kind === "string" ? definition.kind : "guided_practice",
            ) as typeof import("@/lib/db/schema").interactiveActivities.$inferInsert.activityType,
            status: "published",
            title:
              typeof definition.title === "string"
                ? definition.title
                : "Generated interactive activity",
            schemaVersion: "1",
            definition,
            masteryRubric: {},
            metadata: {
              generatedByJobId: job.id,
            },
          });
        }
        break;
      }
      case "plan.adapt": {
        const result = await generatePlanAdaptation(job.inputs as unknown as PlanAdaptInput);
        output = result.output;
        if (job.organizationId && job.learnerId) {
          await repos.copilot.createRecommendation({
            organizationId: job.organizationId,
            learnerId: job.learnerId,
            insightId: null,
            recommendationType: "plan_adjustment",
            status: "proposed",
            title: "AI plan adaptation",
            description: result.output,
            payload: {
              jobId: job.id,
            },
            acceptedAt: null,
            dismissedAt: null,
            metadata: {
              generatedByJobId: job.id,
            },
          });
        }
        break;
      }
      default:
        throw new Error(`Unsupported AI job task: ${job.taskName}`);
    }

    return repos.aiPlatform.updateJob(job.id, {
      status: "completed",
      output: (typeof output === "object" && output !== null
        ? (output as Record<string, unknown>)
        : { result: output, artifactBody }) as Record<string, unknown>,
      completedAt: new Date(),
      errorMessage: null,
    });
  } catch (error) {
    if (job.artifactId) {
      await repos.activities.updateArtifact(job.artifactId, {
        status: "failed",
        qaMetadata: {
          failedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    return repos.aiPlatform.updateJob(job.id, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function* streamChatAnswer(
  input: ChatAnswerInput,
): AsyncIterable<string> {
  const { adapter, model } = getTaskRuntime("chat.answer");
  const prompt = await resolvePrompt("chat.answer");

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
    if (chunk.delta) {
      yield chunk.delta;
    }

    if (chunk.done) {
      break;
    }
  }
}
