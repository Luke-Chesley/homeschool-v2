import "@/lib/server-only";

import { getCurriculumSource } from "@/lib/curriculum/service";
import { getRepositories } from "@/lib/db";
import { executeSessionGenerate, previewSessionGenerate } from "@/lib/learning-core/session";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackProductEvent } from "@/lib/platform/observability";
import type { DailyWorkspaceLessonBuildTrigger } from "@/lib/planning/types";
import {
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
  const launchPlan = source?.launchPlan ?? null;
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
  slotId?: string | null;
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

  const slot =
    (params.slotId
      ? workspaceResult.workspace.slots.find((entry) => entry.id === params.slotId)
      : workspaceResult.workspace.slots[0]) ?? null;

  if (!slot || slot.items.length === 0) {
    throw new Error("No lesson slot is available for lesson plan generation.");
  }

  const source = await getCurriculumSource(workspaceResult.sourceId, params.organizationId);
  const { intake, sourceModel, launchPlan, curriculumLineage } =
    resolveCurriculumLaunchMetadata(source);
  const { workspace, planningContext, sessionTiming, sourceId, sourceTitle } = workspaceResult;
  const routeFingerprint = slot.routeFingerprint;
  const regenerationNote = await getSavedTodayLessonRegenerationNote({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    slotId: slot.id,
    sourceId,
    routeFingerprint,
  });
  const lessonOutcomeFeedback = buildLessonOutcomeFeedback({ workspaceResult });

  const input = {
    title: sourceTitle,
    topic: slot.leadItem.title,
    resolvedTiming: {
      resolvedTotalMinutes: sessionTiming.resolvedTotalMinutes,
      sourceSessionMinutes: sessionTiming.sourceSessionMinutes,
      lessonOverrideMinutes: sessionTiming.lessonOverrideMinutes,
      timingSource: sessionTiming.timingSource,
    },
    objectives: slot.sessionTargets,
    routeItems: slot.items.map((item) => ({
      title: item.title,
      subject: item.subject,
      estimatedMinutes: item.estimatedMinutes,
      objective: item.objective,
      lessonLabel: item.lessonLabel,
      note: item.note,
    })),
    materials: slot.items.flatMap((item) => item.materials).slice(0, 8),
    context: {
      learnerId: workspace.learner.id,
      learnerName: workspace.learner.name,
      curriculumSourceId: sourceId,
      lessonId: slot.leadItem.curriculum?.weeklyRouteItemId,
      standardIds: slot.items.flatMap((item) => item.standards),
      goalIds: slot.items.flatMap((item) => item.goals),
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
            entryStrategy: sourceModel?.entryStrategy ?? null,
            entryLabel: sourceModel?.entryLabel ?? null,
            continuationMode: sourceModel?.continuationMode ?? null,
            recommendedHorizon:
              launchPlan?.chosenHorizon ?? sourceModel?.recommendedHorizon ?? null,
            sourcePackageIds: sourceModel?.sourcePackageIds ?? intake?.sourcePackageIds ?? [],
            sourcePackages: sourceModel?.sourcePackages ?? intake?.sourcePackages ?? [],
            sourceModalities: sourceModel?.sourceModalities ?? intake?.sourceModalities ?? [],
            sourcePackageId: sourceModel?.sourcePackageId ?? intake?.sourcePackageId ?? null,
            sourceModality: sourceModel?.sourceModality ?? intake?.sourceModality ?? null,
            initialSliceUsed: launchPlan?.initialSliceUsed ?? null,
            initialSliceLabel: launchPlan?.initialSliceLabel ?? null,
            openingUnitRefs: launchPlan?.openingUnitRefs ?? [],
            openingSkillNodeIds: launchPlan?.openingSkillNodeIds ?? [],
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
        slot: {
          id: slot.id,
          slotIndex: slot.slotIndex,
          title: slot.title,
        },
        leadLesson: {
          title: slot.leadItem.title,
          subject: slot.leadItem.subject,
          objective: slot.leadItem.objective,
          lessonLabel: slot.leadItem.lessonLabel,
          estimatedMinutes: slot.leadItem.estimatedMinutes,
        },
        planItems: slot.items.map((item) => ({
          title: item.title,
          subject: item.subject,
          objective: item.objective,
          lessonLabel: item.lessonLabel,
          status: item.status,
          estimatedMinutes: item.estimatedMinutes,
          materials: item.materials,
          copilotPrompts: item.copilotPrompts,
        })),
        prepChecklist: slot.prepChecklist,
        sessionTargets: slot.sessionTargets,
        copilotInsertions: workspace.copilotInsertions,
        completionPrompts: workspace.completionPrompts,
        familyNotes: workspace.familyNotes,
      },
    },
  };

  return {
    repos,
    workflowMode,
    workspaceResult,
    slot,
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
  slotId?: string | null;
}) {
  const context = await buildTodayLessonGenerationContext(params);

  return previewSessionGenerate({
    input: context.input,
    surface: "planning",
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    planItemIds: context.slot.items.map((item) => item.id),
    workflowMode: context.workflowMode,
  });
}

export async function generateTodayLessonDraft(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
  slotId?: string | null;
  trigger: TodayLessonGenerationTrigger;
  forceRegenerate?: boolean;
}) {
  const context = await buildTodayLessonGenerationContext(params);
  const existingDraft = context.slot.lessonDraft;
  const lessonBuildMetadata = {
    trigger: params.trigger,
    sourceId: context.sourceId,
    slotId: context.slot.id,
    slotIndex: context.slot.slotIndex,
    routeFingerprint: context.routeFingerprint,
    requestedRoute: context.sourceModel?.requestedRoute ?? context.source?.intake?.requestedRoute ?? null,
    routedRoute: context.sourceModel?.routedRoute ?? context.source?.intake?.route ?? null,
    sourceKind: context.sourceModel?.sourceKind ?? null,
    recommendedHorizon:
      context.launchPlan?.chosenHorizon ?? context.sourceModel?.recommendedHorizon ?? null,
    itemCount: context.slot.items.length,
  };

  if (!params.forceRegenerate && existingDraft?.structured) {
    await markTodayLessonBuildReady({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      slotId: context.slot.id,
      sourceId: context.sourceId,
      routeFingerprint: context.routeFingerprint,
      slotIndex: context.slot.slotIndex,
      title: context.slot.title,
      trigger: params.trigger,
    });

    return {
      structured: existingDraft.structured,
      promptVersion: existingDraft.promptVersion,
      artifactId: null,
      sourceId: context.sourceId,
      sourceTitle: context.sourceTitle,
      slotId: context.slot.id,
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
    slotId: context.slot.id,
    sourceId: context.sourceId,
    routeFingerprint: context.routeFingerprint,
    slotIndex: context.slot.slotIndex,
    title: context.slot.title,
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
      planItemIds: context.slot.items.map((item) => item.id),
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
        routeItemIds: context.slot.items.map((item) => item.id),
        slotId: context.slot.id,
        slotIndex: context.slot.slotIndex,
        trigger: params.trigger,
      },
    });

    const savedDraft = await saveTodayLessonDraft({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      slotId: context.slot.id,
      sourceId: context.sourceId,
      sourceTitle: context.sourceTitle,
      routeFingerprint: context.routeFingerprint,
      slotIndex: context.slot.slotIndex,
      title: context.slot.title,
      structured: result.artifact,
      promptVersion: result.lineage.skill_version,
    });

    await markTodayLessonBuildReady({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      slotId: context.slot.id,
      sourceId: context.sourceId,
      routeFingerprint: context.routeFingerprint,
      slotIndex: context.slot.slotIndex,
      title: context.slot.title,
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
      slotId: context.slot.id,
      trigger: "after_lesson_auto",
    });

    return {
      structured: savedDraft.structured as StructuredLessonDraft,
      promptVersion: savedDraft.promptVersion,
      artifactId: artifact.id,
      sourceId: context.sourceId,
      sourceTitle: context.sourceTitle,
      slotId: context.slot.id,
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
      slotId: context.slot.id,
      sourceId: context.sourceId,
      routeFingerprint: context.routeFingerprint,
      slotIndex: context.slot.slotIndex,
      title: context.slot.title,
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
