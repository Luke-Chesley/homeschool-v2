import "@/lib/server-only";

/**
 * Assignment service — lesson-draft-owned activity creation.
 *
 * Hierarchy: curriculum → lesson draft → one lesson activity → evidence/progress
 *
 * Each lesson draft produces ONE primary activity. The lesson session is the
 * persistence anchor; the lesson draft fingerprint identifies which draft
 * version produced the activity.
 *
 * Stale detection:
 *   When the lesson draft changes (fingerprint changes), the old activity is
 *   archived and a new one generated. Activity reuse is keyed to the lesson
 *   draft identity — not to overlapping skills or plan items.
 *
 * Traceability:
 *   Plan items are stored in activity metadata for reporting/progress mapping.
 *   They do not drive generation.
 */

import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { getTodayWorkspace } from "@/lib/planning/today-service";
import type { PlanItem } from "@/lib/planning/types";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import { computeLessonDraftFingerprint } from "@/lib/lesson-draft/fingerprint";
import { generateActivitySpecForLessonDraft } from "./generation-service";

// ---------------------------------------------------------------------------
// Lesson-draft-owned activity publishing
// ---------------------------------------------------------------------------

/**
 * Generate and publish one activity for a lesson draft.
 *
 * If an activity for the exact same lesson draft version (same fingerprint)
 * already exists and is published, this is a no-op (idempotent).
 *
 * If an activity exists for the session with a DIFFERENT fingerprint, the old
 * activity is archived (stale) and a new one is generated.
 */
export async function publishActivityForLessonDraft(params: {
  organizationId: string;
  learnerId: string;
  lessonSessionId: string;
  lessonDraft: StructuredLessonDraft;
  lessonDraftFingerprint: string;
  learnerName: string;
  workflowMode: string;
  planItems?: PlanItem[];
  leadPlanItemId?: string;
}): Promise<void> {
  const repos = createRepositories(getDb());

  // Idempotent check — same draft version already published
  const existingForDraft = await repos.activities.findActivityForLessonDraft(
    params.lessonSessionId,
    params.lessonDraftFingerprint,
  );
  if (existingForDraft?.status === "published") {
    return;
  }

  // Stale check — archive any published activity with a different fingerprint
  const staleActivity = await repos.activities.findPublishedActivityForSession(
    params.lessonSessionId,
  );
  if (staleActivity && staleActivity.lessonDraftFingerprint !== params.lessonDraftFingerprint) {
    await repos.activities.archiveActivitiesForSession(params.lessonSessionId);
  }

  const genResult = await generateActivitySpecForLessonDraft({
    lessonDraft: params.lessonDraft,
    learnerName: params.learnerName,
    workflowMode: params.workflowMode,
    planItems: params.planItems,
  });

  const planItems = params.planItems ?? [];

  await repos.activities.createActivity({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    planItemId: params.leadPlanItemId ?? null,
    lessonSessionId: params.lessonSessionId,
    lessonDraftFingerprint: params.lessonDraftFingerprint,
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
      lessonDraftFingerprint: params.lessonDraftFingerprint,
      trackedPlanItemIds: planItems.map((p) => p.id),
      linkedSkillTitles: planItems.map((p) => p.title),
      standardIds: planItems.flatMap((p) => p.standards ?? []),
      estimatedMinutes: genResult.spec.estimatedMinutes,
      interactionMode: genResult.spec.interactionMode,
      lessonTitle: params.lessonDraft.title,
      lessonFocus: params.lessonDraft.lesson_focus,
    },
  });
}

// ---------------------------------------------------------------------------
// Batch: ensure one activity per lesson draft for a learner's day
// ---------------------------------------------------------------------------

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

  const { workspace } = workspaceResult;
  const lessonDraft = workspace.lessonDraft?.structured;

  if (!lessonDraft) {
    return repos.activities.listPublishedActivitiesForLearner(params.learnerId);
  }

  const fingerprint = computeLessonDraftFingerprint(lessonDraft);
  const leadItem = workspace.leadItem;
  const leadSessionId = leadItem.sessionRecordId ?? leadItem.workflow?.lessonSessionId;
  const leadPlanItemId = leadItem.planRecordId ?? leadItem.workflow?.planItemId;

  if (leadSessionId) {
    await publishActivityForLessonDraft({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      lessonSessionId: leadSessionId,
      lessonDraft,
      lessonDraftFingerprint: fingerprint,
      learnerName: params.learnerName,
      workflowMode,
      planItems: workspace.items,
      leadPlanItemId: leadPlanItemId ?? undefined,
    });
  }

  return repos.activities.listPublishedActivitiesForLearner(params.learnerId);
}
