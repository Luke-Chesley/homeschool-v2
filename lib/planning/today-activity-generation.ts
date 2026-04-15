import "@/lib/server-only";

import { publishActivityForLessonDraft } from "@/lib/activities/assignment-service";
import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { computeLessonDraftFingerprint } from "@/lib/lesson-draft/fingerprint";
import { trackProductEvent } from "@/lib/platform/observability";
import type { DailyWorkspaceActivityBuildTrigger } from "@/lib/planning/types";
import {
  buildTodayLessonDraftFingerprint,
  getTodayWorkspace,
  markTodayActivityBuildFailed,
  markTodayActivityBuildGenerating,
  markTodayActivityBuildReady,
  queueTodayActivityBuild,
} from "@/lib/planning/today-service";

export async function queueTodayActivityAfterLesson(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
  trigger: DailyWorkspaceActivityBuildTrigger;
}) {
  const workspaceResult = await getTodayWorkspace({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    learnerName: params.learnerName,
    date: params.date,
  });

  if (!workspaceResult?.workspace.lessonDraft?.structured || workspaceResult.workspace.items.length === 0) {
    return null;
  }

  const routeFingerprint = buildTodayLessonDraftFingerprint(
    workspaceResult.workspace.items.map((item) => item.id),
  );
  const lessonSessionId =
    workspaceResult.workspace.leadItem.sessionRecordId ??
    workspaceResult.workspace.leadItem.workflow?.lessonSessionId ??
    null;

  const build = await queueTodayActivityBuild({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    sourceId: workspaceResult.sourceId,
    routeFingerprint,
    lessonSessionId,
    trigger: params.trigger,
  });

  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.todayActivityBuildQueued,
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    metadata: {
      trigger: params.trigger,
      sourceId: workspaceResult.sourceId,
      routeFingerprint,
      lessonSessionId,
      itemCount: workspaceResult.workspace.items.length,
    },
  });

  return build;
}

export async function generateTodayActivity(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
  trigger: DailyWorkspaceActivityBuildTrigger;
}) {
  const repos = createRepositories(getDb());
  const platformSettings = await repos.organizations.findPlatformSettings(params.organizationId);
  const workflowMode = platformSettings?.workflowMode ?? "family_guided";

  const workspaceResult = await getTodayWorkspace({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    learnerName: params.learnerName,
    date: params.date,
  });

  if (!workspaceResult) {
    throw new Error("Workspace not found");
  }

  const lessonDraft = workspaceResult.workspace.lessonDraft?.structured;
  if (!lessonDraft) {
    throw new Error("No lesson draft — generate a lesson plan first.");
  }

  const leadItem = workspaceResult.workspace.leadItem;
  const lessonSessionId = leadItem.sessionRecordId ?? leadItem.workflow?.lessonSessionId;
  const leadPlanItemId = leadItem.planRecordId ?? leadItem.workflow?.planItemId;
  const routeFingerprint = buildTodayLessonDraftFingerprint(
    workspaceResult.workspace.items.map((item) => item.id),
  );

  if (!lessonSessionId) {
    throw new Error("Session record not found — try refreshing the page.");
  }

  await markTodayActivityBuildGenerating({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    sourceId: workspaceResult.sourceId,
    routeFingerprint,
    lessonSessionId,
    trigger: params.trigger,
  });

  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.todayActivityBuildStarted,
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    metadata: {
      trigger: params.trigger,
      sourceId: workspaceResult.sourceId,
      routeFingerprint,
      lessonSessionId,
    },
  });

  try {
    const published = await publishActivityForLessonDraft({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      lessonSessionId,
      lessonDraft,
      lessonDraftFingerprint: computeLessonDraftFingerprint(lessonDraft),
      learnerName: params.learnerName,
      workflowMode,
      planItems: workspaceResult.workspace.items,
      leadPlanItemId: leadPlanItemId ?? undefined,
    });

    await markTodayActivityBuildReady({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      sourceId: workspaceResult.sourceId,
      routeFingerprint,
      lessonSessionId,
      activityId: published.activityId,
      trigger: params.trigger,
    });

    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.todayActivityBuildCompleted,
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      metadata: {
        trigger: params.trigger,
        sourceId: workspaceResult.sourceId,
        routeFingerprint,
        lessonSessionId,
        activityId: published.activityId,
        reusedExisting: published.reusedExisting,
      },
    });

    return published;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activity generation failed.";

    await markTodayActivityBuildFailed({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      sourceId: workspaceResult.sourceId,
      routeFingerprint,
      lessonSessionId,
      trigger: params.trigger,
      error: message,
    });

    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.todayActivityBuildFailed,
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      metadata: {
        trigger: params.trigger,
        sourceId: workspaceResult.sourceId,
        routeFingerprint,
        lessonSessionId,
        error: message,
      },
    });

    throw error;
  }
}
