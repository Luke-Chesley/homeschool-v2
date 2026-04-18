import "@/lib/server-only";

import { getCurriculumSource } from "@/lib/curriculum/service";
import { getRepositories } from "@/lib/db";
import { executeSessionGenerate, previewSessionGenerate } from "@/lib/learning-core/session";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackProductEvent } from "@/lib/platform/observability";
import type { DailyWorkspaceLessonBuildTrigger } from "@/lib/planning/types";
import {
  buildTodayLessonDraftFingerprint,
  getSavedTodayLessonRegenerationNote,
  getTodayWorkspaceView,
  materializeTodayWorkspace,
  markTodayLessonBuildFailed,
  markTodayLessonBuildGenerating,
  markTodayLessonBuildReady,
  saveTodayLessonDraft,
} from "@/lib/planning/today-service";
import { queueTodayActivityAfterLesson } from "@/lib/planning/today-activity-generation";

type TodayLessonGenerationTrigger = DailyWorkspaceLessonBuildTrigger;
type TodayWorkspaceResult = NonNullable<Awaited<ReturnType<typeof getTodayWorkspaceView>>>;
type CurriculumSourceResult = Awaited<ReturnType<typeof getCurriculumSource>>;
type ResolvedSourceModel = NonNullable<NonNullable<CurriculumSourceResult>["sourceModel"]>;
type ResolvedLaunchPlan = NonNullable<NonNullable<CurriculumSourceResult>["launchPlan"]>;

function resolveCurriculumLaunchMetadata(source: CurriculumSourceResult) {
  const intake = source?.intake ?? null;
  const sourceModel = source?.sourceModel ?? intake?.sourceModel ?? null;
  const launchPlan = source?.launchPlan ?? intake?.launchPlan ?? null;
  const curriculumLineage = source?.curriculumLineage ?? intake?.curriculumLineage ?? null;

  return {
    intake,
    sourceModel: sourceModel as ResolvedSourceModel | null,
    launchPlan: launchPlan as ResolvedLaunchPlan | null,
    curriculumLineage,
  };
}

function buildTodayLessonGenerationSummary(params: {
  workspaceResult: TodayWorkspaceResult;
}) {
  const { workspaceResult } = params;

  return {
    itemCount: workspaceResult.workspace.items.length,
    totalMinutes: workspaceResult.sessionTiming.resolvedTotalMinutes,
    timingSource: workspaceResult.sessionTiming.timingSource,
    objectiveCount: workspaceResult.workspace.sessionTargets.length,
    weekLabel: workspaceResult.planningContext?.weeklyPlanningSnapshot?.weekLabel,
    weekHighlights: workspaceResult.planningContext?.weeklyPlanningSnapshot?.highlights ?? [],
  };
}

function buildLessonOutcomeFeedback(params: {
  workspaceResult: TodayWorkspaceResult;
}) {
  const { workspaceResult } = params;
  const feedbackNotes = [...(workspaceResult.planningContext?.feedbackNotes ?? [])];
  const recentOutcomes = workspaceResult.workspace.items
    .filter((item) => item.latestEvaluation)
    .slice(0, 5)
    .map((item) => {
      const evaluation = item.latestEvaluation!;
      const title = item.title;
      const status = evaluation.label;
      const date = evaluation.createdAt.slice(0, 10);
      const summary = evaluation.note?.trim().length
        ? `${title}: ${status}. ${evaluation.note.trim()}`
        : `${title}: ${status}.`;

      feedbackNotes.push(summary);

      return {
        title,
        status,
        date,
      };
    });

  return {
    feedbackNotes,
    recentOutcomes,
  };
}

async function buildTodayLessonGenerationContext(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}) {
  const repos = getRepositories();
  const platformSettings = await repos.organizations.findPlatformSettings(params.organizationId);
  const workflowMode = platformSettings?.workflowMode ?? "family_guided";

  await materializeTodayWorkspace({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    learnerName: params.learnerName,
    date: params.date,
  });

  const workspaceResult = await getTodayWorkspaceView({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    learnerName: params.learnerName,
    date: params.date,
  });

  if (!workspaceResult || workspaceResult.workspace.items.length === 0) {
    throw new Error("No route items available for lesson plan generation.");
  }

  const source = await getCurriculumSource(workspaceResult.sourceId, params.organizationId);
  const { intake, sourceModel, launchPlan, curriculumLineage } =
    resolveCurriculumLaunchMetadata(source);
  const { workspace, planningContext, sessionTiming, sourceId, sourceTitle } = workspaceResult;
  const routeFingerprint = buildTodayLessonDraftFingerprint(workspace.items.map((item) => item.id));
  const regenerationNote = await getSavedTodayLessonRegenerationNote({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    sourceId,
    routeFingerprint,
  });
  const lessonOutcomeFeedback = buildLessonOutcomeFeedback({ workspaceResult });

  const input = {
    title: sourceTitle,
    topic: workspace.leadItem.title,
    resolvedTiming: {
      resolvedTotalMinutes: sessionTiming.resolvedTotalMinutes,
      sourceSessionMinutes: sessionTiming.sourceSessionMinutes,
      lessonOverrideMinutes: sessionTiming.lessonOverrideMinutes,
      timingSource: sessionTiming.timingSource,
    },
    objectives: workspace.sessionTargets,
    routeItems: workspace.items.map((item) => ({
      title: item.title,
      subject: item.subject,
      estimatedMinutes: item.estimatedMinutes,
      objective: item.objective,
      lessonLabel: item.lessonLabel,
      note: item.note,
    })),
    materials: workspace.items.flatMap((item) => item.materials).slice(0, 8),
    context: {
      learnerId: workspace.learner.id,
      learnerName: workspace.learner.name,
      curriculumSourceId: sourceId,
      lessonId: workspace.leadItem.curriculum?.weeklyRouteItemId,
      standardIds: workspace.items.flatMap((item) => item.standards),
      goalIds: workspace.items.flatMap((item) => item.goals),
      curriculumSnapshot: planningContext?.curriculumSnapshot,
      weeklyPlanningSnapshot: planningContext?.weeklyPlanningSnapshot,
      feedbackNotes: lessonOutcomeFeedback.feedbackNotes,
      recentOutcomes: lessonOutcomeFeedback.recentOutcomes,
      onboardingIntake: intake || sourceModel || launchPlan
        ? {
            requestedRoute: sourceModel?.requestedRoute ?? intake?.requestedRoute ?? null,
            routedRoute: sourceModel?.routedRoute ?? intake?.route ?? null,
            confidence: sourceModel?.confidence ?? null,
            sourceKind: sourceModel?.sourceKind ?? null,
            entryStrategy:
              sourceModel?.entryStrategy ?? launchPlan?.entryStrategy ?? null,
            entryLabel:
              sourceModel?.entryLabel ?? launchPlan?.entryLabel ?? null,
            continuationMode:
              sourceModel?.continuationMode ?? launchPlan?.continuationMode ?? null,
            recommendedHorizon:
              launchPlan?.recommendedHorizon ?? sourceModel?.recommendedHorizon ?? null,
            sourcePackageIds: sourceModel?.sourcePackageIds ?? intake?.sourcePackageIds ?? [],
            sourcePackages: sourceModel?.sourcePackages ?? intake?.sourcePackages ?? [],
            sourceModalities: sourceModel?.sourceModalities ?? intake?.sourceModalities ?? [],
            sourcePackageId: sourceModel?.sourcePackageId ?? intake?.sourcePackageId ?? null,
            sourceModality: sourceModel?.sourceModality ?? intake?.sourceModality ?? null,
            initialSliceUsed: launchPlan?.initialSliceUsed ?? null,
            initialSliceLabel: launchPlan?.initialSliceLabel ?? null,
            openingLessonCount: launchPlan?.openingLessonCount ?? null,
            scopeSummary: launchPlan?.scopeSummary ?? null,
            assumptions: sourceModel?.assumptions ?? [],
            detectedChunks: sourceModel?.detectedChunks ?? [],
            followUpQuestion: sourceModel?.followUpQuestion ?? null,
            needsConfirmation: sourceModel?.needsConfirmation ?? null,
            sourceModel,
            launchPlan,
            curriculumLineage,
          }
        : null,
      parentRegenerationNote:
        typeof regenerationNote === "string" && regenerationNote.trim().length > 0
          ? regenerationNote
          : null,
      dailyWorkspaceSnapshot: {
        date: workspace.date,
        headline: workspace.headline,
        leadLesson: {
          title: workspace.leadItem.title,
          subject: workspace.leadItem.subject,
          objective: workspace.leadItem.objective,
          lessonLabel: workspace.leadItem.lessonLabel,
          estimatedMinutes: workspace.leadItem.estimatedMinutes,
        },
        planItems: workspace.items.map((item) => ({
          title: item.title,
          subject: item.subject,
          objective: item.objective,
          lessonLabel: item.lessonLabel,
          status: item.status,
          estimatedMinutes: item.estimatedMinutes,
          materials: item.materials,
          copilotPrompts: item.copilotPrompts,
        })),
        prepChecklist: workspace.prepChecklist,
        sessionTargets: workspace.sessionTargets,
        copilotInsertions: workspace.copilotInsertions,
        completionPrompts: workspace.completionPrompts,
        familyNotes: workspace.familyNotes,
      },
    },
  } as const;

  return {
    repos,
    workflowMode,
    workspaceResult,
    source,
    sourceId,
    sourceTitle,
    routeFingerprint,
    input,
    sourceModel,
    launchPlan,
    curriculumLineage,
  };
}

export async function previewTodayLessonDraft(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}) {
  const context = await buildTodayLessonGenerationContext(params);

  return previewSessionGenerate({
    input: context.input,
    surface: "planning",
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    planItemIds: context.workspaceResult.workspace.items.map((item) => item.id),
    workflowMode: context.workflowMode,
  });
}

export async function generateTodayLessonDraft(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
  trigger: TodayLessonGenerationTrigger;
  forceRegenerate?: boolean;
}) {
  const context = await buildTodayLessonGenerationContext(params);
  const existingDraft = context.workspaceResult.workspace.lessonDraft;
  const lessonBuildMetadata = {
    trigger: params.trigger,
    sourceId: context.sourceId,
    routeFingerprint: context.routeFingerprint,
    requestedRoute: context.sourceModel?.requestedRoute ?? context.source?.intake?.requestedRoute ?? null,
    routedRoute: context.sourceModel?.routedRoute ?? context.source?.intake?.route ?? null,
    sourceKind: context.sourceModel?.sourceKind ?? null,
    recommendedHorizon:
      context.launchPlan?.recommendedHorizon ?? context.sourceModel?.recommendedHorizon ?? null,
    itemCount: context.workspaceResult.workspace.items.length,
  };

  if (!params.forceRegenerate && existingDraft?.structured) {
    await markTodayLessonBuildReady({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      sourceId: context.sourceId,
      routeFingerprint: context.routeFingerprint,
      trigger: params.trigger,
    });

    return {
      structured: existingDraft.structured,
      promptVersion: existingDraft.promptVersion,
      artifactId: null,
      sourceId: context.sourceId,
      sourceTitle: context.sourceTitle,
      routeFingerprint: context.routeFingerprint,
      date: params.date,
      summary: buildTodayLessonGenerationSummary({ workspaceResult: context.workspaceResult }),
      lineage: null,
      trace: null,
      reusedExistingDraft: true,
    };
  }

  await markTodayLessonBuildGenerating({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    sourceId: context.sourceId,
    routeFingerprint: context.routeFingerprint,
    trigger: params.trigger,
  });

  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.todayLessonBuildStarted,
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    metadata: lessonBuildMetadata,
  });

  try {
    const result = await executeSessionGenerate({
      input: context.input,
      surface: "planning",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planItemIds: context.workspaceResult.workspace.items.map((item) => item.id),
      workflowMode: context.workflowMode,
    });

    const artifact = await context.repos.activities.createArtifact({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planItemId: null,
      lessonSessionId: null,
      artifactType: "lesson_plan",
      title: `${context.sourceTitle} lesson draft`,
      status: "ready",
      body: JSON.stringify(result.artifact),
      promptVersion: result.lineage.skill_version,
      promptTemplateId: null,
      generationJobId: null,
      storagePath: null,
      providerId: result.lineage.provider,
      modelId: result.lineage.model,
      inputHash: null,
      lineageParentId: null,
      supersededByArtifactId: null,
      approvedAt: null,
      archivedAt: null,
      sourceContext: {
        date: params.date,
        sourceId: context.sourceId,
        routeFingerprint: context.routeFingerprint,
        schemaVersion: result.artifact.schema_version,
      },
      qaMetadata: {
        requestId: result.trace.request_id,
      },
      costMetadata: {},
      metadata: {
        routeItemIds: context.workspaceResult.workspace.items.map((item) => item.id),
        trigger: params.trigger,
      },
    });

    const savedDraft = await saveTodayLessonDraft({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      sourceId: context.sourceId,
      sourceTitle: context.sourceTitle,
      routeFingerprint: context.routeFingerprint,
      structured: result.artifact,
      promptVersion: result.lineage.skill_version,
    });

    await markTodayLessonBuildReady({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      sourceId: context.sourceId,
      routeFingerprint: context.routeFingerprint,
      trigger: params.trigger,
    });

    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.todayLessonBuildCompleted,
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      metadata: {
        ...lessonBuildMetadata,
        promptVersion: result.lineage.skill_version,
        requestId: result.trace.request_id,
      },
    });

    await queueTodayActivityAfterLesson({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      learnerName: params.learnerName,
      date: params.date,
      trigger: "after_lesson_auto",
    });

    return {
      structured: savedDraft.structured as StructuredLessonDraft,
      promptVersion: savedDraft.promptVersion,
      artifactId: artifact.id,
      sourceId: context.sourceId,
      sourceTitle: context.sourceTitle,
      routeFingerprint: context.routeFingerprint,
      date: params.date,
      summary: buildTodayLessonGenerationSummary({ workspaceResult: context.workspaceResult }),
      lineage: result.lineage,
      trace: result.trace,
      reusedExistingDraft: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lesson plan generation failed.";

    await markTodayLessonBuildFailed({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      sourceId: context.sourceId,
      routeFingerprint: context.routeFingerprint,
      trigger: params.trigger,
      error: message,
    });

    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.todayLessonBuildFailed,
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      metadata: {
        ...lessonBuildMetadata,
        error: message,
      },
    });

    throw error;
  }
}
