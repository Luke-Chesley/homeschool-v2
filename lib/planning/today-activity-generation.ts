import "@/lib/server-only";

import { publishActivityForLessonDraft } from "@/lib/activities/assignment-service";
import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { computeLessonDraftFingerprint } from "@/lib/lesson-draft/fingerprint";
import { trackProductEvent } from "@/lib/platform/observability";
import type { DailyWorkspaceActivityBuildTrigger } from "@/lib/planning/types";
import {
  getTodayWorkspaceView,
  materializeTodayWorkspace,
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
  slotId?: string | null;
  trigger: DailyWorkspaceActivityBuildTrigger;
}) {
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

  const slot =
    (params.slotId
      ? workspaceResult?.workspace.slots.find((entry) => entry.id === params.slotId)
      : workspaceResult?.workspace.slots[0]) ?? null;
  if (!workspaceResult || !slot?.lessonDraft?.structured || slot.items.length === 0) {
    return null;
  }

  const routeFingerprint = slot.routeFingerprint;
  const lessonSessionId =
    slot.leadItem.sessionRecordId ??
    slot.leadItem.workflow?.lessonSessionId ??
    null;

  const build = await queueTodayActivityBuild({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    slotId: slot.id,
    sourceId: workspaceResult.sourceId,
    routeFingerprint,
    slotIndex: slot.slotIndex,
    title: slot.title,
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
      slotId: slot.id,
      slotIndex: slot.slotIndex,
      routeFingerprint,
      lessonSessionId,
      itemCount: slot.items.length,
    },
  });

  return build;
}

export async function generateTodayActivity(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
  slotId?: string | null;
  trigger: DailyWorkspaceActivityBuildTrigger;
}) {
  const repos = createRepositories(getDb());
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

  if (!workspaceResult) {
    throw new Error("Workspace not found");
  }

  const slot =
    (params.slotId
      ? workspaceResult.workspace.slots.find((entry) => entry.id === params.slotId)
      : workspaceResult.workspace.slots[0]) ?? null;
  if (!slot) {
    throw new Error("Lesson slot not found.");
  }

  const lessonDraft = slot.lessonDraft?.structured;
  if (!lessonDraft) {
    throw new Error("No lesson draft — generate a lesson plan first.");
  }

  const leadItem = slot.leadItem;
  const lessonSessionId = leadItem.sessionRecordId ?? leadItem.workflow?.lessonSessionId;
  const leadPlanItemId = leadItem.planRecordId ?? leadItem.workflow?.planItemId;
  const routeFingerprint = slot.routeFingerprint;

  if (!lessonSessionId) {
    throw new Error("Session record not found — try refreshing the page.");
  }

  await markTodayActivityBuildGenerating({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    slotId: slot.id,
    sourceId: workspaceResult.sourceId,
    routeFingerprint,
    slotIndex: slot.slotIndex,
    title: slot.title,
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
        slotId: slot.id,
        slotIndex: slot.slotIndex,
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
      planItems: slot.items,
      leadPlanItemId: leadPlanItemId ?? undefined,
    });

    await markTodayActivityBuildReady({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      slotId: slot.id,
      sourceId: workspaceResult.sourceId,
      routeFingerprint,
      slotIndex: slot.slotIndex,
      title: slot.title,
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
        slotId: slot.id,
        slotIndex: slot.slotIndex,
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
      slotId: slot.id,
      sourceId: workspaceResult.sourceId,
      routeFingerprint,
      slotIndex: slot.slotIndex,
      title: slot.title,
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
        slotId: slot.id,
        slotIndex: slot.slotIndex,
        routeFingerprint,
        lessonSessionId,
        error: message,
      },
    });

    throw error;
  }
}
