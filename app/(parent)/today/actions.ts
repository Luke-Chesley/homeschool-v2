"use server";

import { revalidatePath } from "next/cache";

import { requireAppSession } from "@/lib/app-session/server";
import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { getTodayWorkspace } from "@/lib/planning/today-service";
import {
  buildActivityContextFromLessonDraft,
  buildPromptInput,
} from "@/lib/activities/generation-context";
import {
  ACTIVITY_SPEC_SYSTEM_PROMPT,
  buildActivitySpecUserPrompt,
} from "@/lib/prompts/activity-spec";
import { publishActivityForLessonDraft } from "@/lib/activities/assignment-service";
import { computeLessonDraftFingerprint } from "@/lib/lesson-draft/fingerprint";
import {
  completeTodayPlanItem,
  partiallyCompleteTodayPlanItem,
  pushTodayPlanItemToTomorrow,
  resetTodayPlanItem,
  repeatTodayPlanItemTomorrow,
  skipTodayPlanItem,
  swapTodayPlanItemWithAlternate,
} from "@/lib/planning/today-service";

// ---------------------------------------------------------------------------
// Lesson-draft activity status
// ---------------------------------------------------------------------------

export type LessonDraftActivityStatus =
  | "no_draft"
  | "no_activity"
  | "ready"
  | "stale";

export interface LessonDraftActivityState {
  ok: boolean;
  status?: LessonDraftActivityStatus;
  sessionId?: string;
  activityId?: string;
  error?: string;
}

export type TodayPlanItemAction =
  | "complete"
  | "reset"
  | "partial"
  | "push_to_tomorrow"
  | "skip_today"
  | "repeat_tomorrow"
  | "swap_with_alternate";

export interface TodayPlanItemActionResult {
  ok: boolean;
  action: TodayPlanItemAction;
  planItemId: string;
  message?: string;
  error?: string;
}

/**
 * Get the current activity state for today's lesson draft.
 * Drives the UI: no_draft / no_activity / ready / stale.
 */
export async function getLessonDraftActivityStatusAction(
  date: string,
): Promise<LessonDraftActivityState> {
  try {
    const session = await requireAppSession();
    const repos = createRepositories(getDb());

    const workspaceResult = await getTodayWorkspace({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date,
    });

    if (!workspaceResult) return { ok: false, error: "Workspace not found" };

    const lessonDraft = workspaceResult.workspace.lessonDraft?.structured;
    if (!lessonDraft) return { ok: true, status: "no_draft" };

    const leadItem = workspaceResult.workspace.leadItem;
    const leadSessionId = leadItem.sessionRecordId ?? leadItem.workflow?.lessonSessionId;
    if (!leadSessionId) return { ok: true, status: "no_activity" };

    const currentFingerprint = computeLessonDraftFingerprint(lessonDraft);
    const existingActivity = await repos.activities.findPublishedActivityForSession(leadSessionId);

    if (!existingActivity) return { ok: true, status: "no_activity", sessionId: leadSessionId };

    const isStale = existingActivity.lessonDraftFingerprint !== currentFingerprint;
    return {
      ok: true,
      status: isStale ? "stale" : "ready",
      sessionId: leadSessionId,
      activityId: existingActivity.id,
    };
  } catch (err) {
    console.error("[getLessonDraftActivityStatusAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Status check failed" };
  }
}

export async function updateTodayPlanItemAction(input: {
  date: string;
  planItemId: string;
  action: TodayPlanItemAction;
  alternateWeeklyRouteItemId?: string;
}): Promise<TodayPlanItemActionResult> {
  try {
    const session = await requireAppSession();

    if (input.action === "complete") {
      await completeTodayPlanItem({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        weeklyRouteItemId: input.planItemId,
        date: input.date,
      });
    } else if (input.action === "reset") {
      await resetTodayPlanItem({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        weeklyRouteItemId: input.planItemId,
        date: input.date,
      });
    } else if (input.action === "partial") {
      await partiallyCompleteTodayPlanItem({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        weeklyRouteItemId: input.planItemId,
        date: input.date,
      });
    } else if (input.action === "skip_today") {
      await skipTodayPlanItem({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        weeklyRouteItemId: input.planItemId,
        date: input.date,
      });
    } else if (input.action === "push_to_tomorrow") {
      await pushTodayPlanItemToTomorrow(
        session.activeLearner.id,
        input.planItemId,
        input.date,
      );
    } else if (input.action === "repeat_tomorrow") {
      await repeatTodayPlanItemTomorrow(
        session.activeLearner.id,
        input.planItemId,
        input.date,
      );
    } else if (
      input.action === "swap_with_alternate" &&
      input.alternateWeeklyRouteItemId
    ) {
      await swapTodayPlanItemWithAlternate(
        session.activeLearner.id,
        input.planItemId,
        input.alternateWeeklyRouteItemId,
        input.date,
      );
    } else {
      return {
        ok: false,
        action: input.action,
        planItemId: input.planItemId,
        error: "That action is missing required data.",
      };
    }

    revalidatePath("/today");
    revalidatePath("/planning");
    revalidatePath("/tracking");
    revalidatePath("/tracking/reports");

    const messageByAction: Record<TodayPlanItemAction, string> = {
      complete: "Marked done and saved to today's record.",
      reset: "Returned to today's plan and cleared the saved completion.",
      partial: "Marked partial and carried the remainder forward.",
      push_to_tomorrow: "Moved forward to tomorrow.",
      skip_today: "Skipped today and saved to today's record.",
      repeat_tomorrow: "Added a repeat for tomorrow.",
      swap_with_alternate: "Replaced with a lighter option.",
    };

    return {
      ok: true,
      action: input.action,
      planItemId: input.planItemId,
      message: messageByAction[input.action],
    };
  } catch (err) {
    console.error("[updateTodayPlanItemAction]", err);
    return {
      ok: false,
      action: input.action,
      planItemId: input.planItemId,
      error: err instanceof Error ? err.message : "Could not save the today action.",
    };
  }
}

// ---------------------------------------------------------------------------
// Generate / regenerate activity for today's lesson draft
// ---------------------------------------------------------------------------

/**
 * Generate (or regenerate) one activity for today's lesson draft.
 * Idempotent when the draft has not changed.
 * Archives and replaces the activity when the draft changed.
 */
export async function generateLessonDraftActivityAction(
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

    const lessonDraft = workspaceResult.workspace.lessonDraft?.structured;
    if (!lessonDraft) {
      return { ok: false, error: "No lesson draft — generate a lesson plan first." };
    }

    const leadItem = workspaceResult.workspace.leadItem;
    const leadSessionId = leadItem.sessionRecordId ?? leadItem.workflow?.lessonSessionId;
    const leadPlanItemId = leadItem.planRecordId ?? leadItem.workflow?.planItemId;

    if (!leadSessionId) {
      return { ok: false, error: "Session record not found — try refreshing the page." };
    }

    await publishActivityForLessonDraft({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      lessonSessionId: leadSessionId,
      lessonDraft,
      lessonDraftFingerprint: computeLessonDraftFingerprint(lessonDraft),
      learnerName: session.activeLearner.displayName,
      workflowMode,
      planItems: workspaceResult.workspace.items,
      leadPlanItemId: leadPlanItemId ?? undefined,
    });

    return { ok: true };
  } catch (err) {
    console.error("[generateLessonDraftActivityAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Generation failed" };
  }
}

// ---------------------------------------------------------------------------
// Prompt preview for today's lesson draft (debug / transparency)
// ---------------------------------------------------------------------------

export async function getLessonDraftPromptPreviewAction(
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

    const lessonDraft = workspaceResult.workspace.lessonDraft?.structured;
    if (!lessonDraft) return { ok: false, error: "No lesson draft available" };

    const ctx = buildActivityContextFromLessonDraft({
      lessonDraft,
      learnerName: session.activeLearner.displayName,
      workflowMode,
      planItems: workspaceResult.workspace.items,
    });

    const userPrompt = buildActivitySpecUserPrompt(buildPromptInput(ctx));
    return { ok: true, systemPrompt: ACTIVITY_SPEC_SYSTEM_PROMPT, userPrompt };
  } catch (err) {
    console.error("[getLessonDraftPromptPreviewAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to build prompt" };
  }
}
