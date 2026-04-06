"use server";

import { requireAppSession } from "@/lib/app-session/server";
import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { getTodayWorkspace } from "@/lib/planning/today-service";
import {
  buildContextFromLessonSession,
  buildContextFromPlanItem,
  buildPromptInput,
} from "@/lib/activities/generation-context";
import {
  ACTIVITY_SPEC_SYSTEM_PROMPT,
  buildActivitySpecUserPrompt,
} from "@/lib/prompts/activity-spec";
import { publishActivitySpecForItem } from "@/lib/activities/assignment-service";

// ---------------------------------------------------------------------------
// Generate activity spec — lesson-first, item-second
// ---------------------------------------------------------------------------

export async function generateActivityAction(
  itemId: string,
  date: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireAppSession();
    const repos = createRepositories(getDb());

    const platformSettings = await repos.organizations.findPlatformSettings(
      session.organization.id,
    );
    const workflowMode = platformSettings?.workflowMode ?? "family_guided";

    const workspaceResult = await getTodayWorkspace({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date,
    });

    if (!workspaceResult) return { ok: false, error: "Workspace not found" };

    const planItem = workspaceResult.workspace.items.find((item) => item.id === itemId);
    if (!planItem) return { ok: false, error: "Plan item not found" };

    const durablePlanItemId = planItem.planRecordId ?? planItem.workflow?.planItemId;
    const durableSessionId = planItem.sessionRecordId ?? planItem.workflow?.lessonSessionId;

    if (!durablePlanItemId || !durableSessionId) {
      return {
        ok: false,
        error: "Plan item is missing required IDs — try refreshing the page.",
      };
    }

    const existingActivities = await repos.activities.listActivitiesForPlanItem(durablePlanItemId);
    if (existingActivities.some((a) => a.status === "published")) {
      return { ok: true }; // idempotent
    }

    // Pass the lesson draft when available — it becomes the primary generation input
    const lessonDraft = workspaceResult.workspace.lessonDraft?.structured;

    await publishActivitySpecForItem({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      planItemId: durablePlanItemId,
      lessonSessionId: durableSessionId,
      planItem,
      learnerName: session.activeLearner.displayName,
      workflowMode,
      lessonDraft,
    });

    return { ok: true };
  } catch (err) {
    console.error("[generateActivityAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Generation failed" };
  }
}

// ---------------------------------------------------------------------------
// Return the generation prompt (debug / transparency)
// ---------------------------------------------------------------------------

export async function getActivityPromptPreviewAction(
  itemId: string,
  date: string,
): Promise<{
  ok: boolean;
  systemPrompt?: string;
  userPrompt?: string;
  error?: string;
}> {
  try {
    const session = await requireAppSession();
    const repos = createRepositories(getDb());

    const platformSettings = await repos.organizations.findPlatformSettings(
      session.organization.id,
    );
    const workflowMode = platformSettings?.workflowMode ?? "family_guided";

    const workspaceResult = await getTodayWorkspace({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date,
    });

    if (!workspaceResult) return { ok: false, error: "Workspace not found" };

    const planItem = workspaceResult.workspace.items.find((item) => item.id === itemId);
    if (!planItem) return { ok: false, error: "Plan item not found" };

    // Mirror the same context-building logic as generation — lesson-first
    const lessonDraft = workspaceResult.workspace.lessonDraft?.structured;
    const ctx = lessonDraft
      ? buildContextFromLessonSession({
          lessonDraft,
          planItem,
          learnerName: session.activeLearner.displayName,
          workflowMode,
        })
      : buildContextFromPlanItem(planItem, session.activeLearner.displayName, workflowMode);

    const promptInput = buildPromptInput(ctx);
    const userPrompt = buildActivitySpecUserPrompt(promptInput);

    return { ok: true, systemPrompt: ACTIVITY_SPEC_SYSTEM_PROMPT, userPrompt };
  } catch (err) {
    console.error("[getActivityPromptPreviewAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to build prompt" };
  }
}
