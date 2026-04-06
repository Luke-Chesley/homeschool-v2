import "@/lib/server-only";

/**
 * Assignment service — lesson-first activity creation.
 *
 * Activities are generated from a lesson session + lesson draft, with plan
 * items providing optional scope narrowing. The lesson session is the primary
 * ownership anchor; planItemId is secondary scope metadata.
 *
 * Generation path:
 *   1. Structured lesson draft available → generateActivitySpecForLessonSession()
 *   2. No lesson draft → generateActivitySpecForPlanItem() (fallback)
 *
 * Persistence hierarchy:
 *   activity → lessonSession (primary parent)
 *   activity → planItem (scope/route reference, secondary)
 */

import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { getTodayWorkspace } from "@/lib/planning/today-service";
import type { PlanItem } from "@/lib/planning/types";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import {
  generateActivitySpecForLessonSession,
  generateActivitySpecForPlanItem,
} from "./generation-service";

export async function publishActivitySpecForItem(params: {
  organizationId: string;
  learnerId: string;
  planItemId: string;
  lessonSessionId: string;
  planItem: PlanItem;
  learnerName: string;
  workflowMode: string;
  /** Structured lesson draft — primary generation input when available */
  lessonDraft?: StructuredLessonDraft;
}): Promise<void> {
  const repos = createRepositories(getDb());

  // Lesson-first: use lesson draft as primary context when available
  const genResult = params.lessonDraft
    ? await generateActivitySpecForLessonSession({
        lessonDraft: params.lessonDraft,
        planItem: params.planItem,
        learnerName: params.learnerName,
        workflowMode: params.workflowMode,
      })
    : await generateActivitySpecForPlanItem(
        params.planItem,
        params.learnerName,
        params.workflowMode,
      );

  await repos.activities.createActivity({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    planItemId: params.planItemId,
    lessonSessionId: params.lessonSessionId,
    artifactId: null,
    activityType: "activity_spec",
    status: "published",
    title: genResult.spec.title,
    schemaVersion: "2",
    definition: genResult.spec as unknown as Record<string, unknown>,
    masteryRubric: {
      activityKind: genResult.spec.activityKind,
      scoringMode: genResult.spec.scoringModel.mode,
      linkedObjectiveIds: genResult.spec.linkedObjectiveIds,
      aiGenerated: genResult.aiGenerated,
      promptVersion: genResult.promptVersion,
    },
    metadata: {
      // Primary parent — lesson session
      sessionId: params.lessonSessionId,
      // Scope metadata — plan item reference
      weeklyRouteItemId: params.planItem.id,
      sourceLabel: params.planItem.sourceLabel,
      lessonLabel: params.planItem.lessonLabel,
      standardIds: params.planItem.standards,
      estimatedMinutes: genResult.spec.estimatedMinutes,
      interactionMode: genResult.spec.interactionMode,
      // Generation provenance
      lessonDraftUsed: Boolean(params.lessonDraft),
    },
  });
}

export async function ensurePublishedActivitiesForLearner(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date?: string;
}) {
  const repos = createRepositories(getDb());
  const platformSettings = await repos.organizations.findPlatformSettings(params.organizationId);
  const workflowMode = platformSettings?.workflowMode ?? "family_guided";
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  const workspaceResult = await getTodayWorkspace({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    learnerName: params.learnerName,
    date,
  });

  if (!workspaceResult) {
    return [];
  }

  // Lesson draft is shared across all plan items from the same source
  const lessonDraft = workspaceResult.workspace.lessonDraft?.structured;

  for (const planItem of workspaceResult.workspace.items) {
    const durablePlanItemId = planItem.planRecordId ?? planItem.workflow?.planItemId;
    const durableSessionId = planItem.sessionRecordId ?? planItem.workflow?.lessonSessionId;

    if (!durablePlanItemId || !durableSessionId) {
      continue;
    }

    const existingActivities = await repos.activities.listActivitiesForPlanItem(durablePlanItemId);
    if (existingActivities.find((a) => a.status === "published")) {
      continue;
    }

    await publishActivitySpecForItem({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planItemId: durablePlanItemId,
      lessonSessionId: durableSessionId,
      planItem,
      learnerName: params.learnerName,
      workflowMode,
      lessonDraft,
    });
  }

  return repos.activities.listPublishedActivitiesForLearner(params.learnerId);
}
