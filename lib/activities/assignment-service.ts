import "@/lib/server-only";

/**
 * Assignment service — spec-driven activity creation.
 *
 * Replaces the old fixed-blueprint system. Activities are now generated as
 * structured ActivitySpecs via the generation service, then persisted in
 * interactive_activities with activityType = "activity_spec" and
 * schemaVersion = "2".
 *
 * The old buildActivityBlueprint / buildGuidedPracticeDefinition / etc.
 * functions are removed. All new activities use the canonical ActivitySpec.
 */

import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { getTodayWorkspace } from "@/lib/planning/today-service";
import type { PlanItem } from "@/lib/planning/types";
import { generateActivitySpecForPlanItem } from "./generation-service";

export async function publishActivitySpecForItem(params: {
  organizationId: string;
  learnerId: string;
  planItemId: string;
  lessonSessionId: string;
  planItem: PlanItem;
  learnerName: string;
  workflowMode: string;
}): Promise<void> {
  const repos = createRepositories(getDb());

  const genResult = await generateActivitySpecForPlanItem(
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
      sessionId: params.lessonSessionId,
      weeklyRouteItemId: params.planItem.id,
      sourceLabel: params.planItem.sourceLabel,
      lessonLabel: params.planItem.lessonLabel,
      standardIds: params.planItem.standards,
      estimatedMinutes: genResult.spec.estimatedMinutes,
      interactionMode: genResult.spec.interactionMode,
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

  for (const planItem of workspaceResult.workspace.items) {
    const durablePlanItemId = planItem.planRecordId ?? planItem.workflow?.planItemId;
    const durableSessionId = planItem.sessionRecordId ?? planItem.workflow?.lessonSessionId;

    if (!durablePlanItemId || !durableSessionId) {
      continue;
    }

    const existingActivities = await repos.activities.listActivitiesForPlanItem(durablePlanItemId);
    const publishedActivity = existingActivities.find((activity) => activity.status === "published");
    if (publishedActivity) {
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
    });
  }

  return repos.activities.listPublishedActivitiesForLearner(params.learnerId);
}
