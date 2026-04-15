"use server";

import { revalidatePath } from "next/cache";

import { requireAppSession } from "@/lib/app-session/server";
import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import {
  getTodayWorkspace,
  saveTodayExpansionIntent,
  saveTodayLessonRegenerationNote,
} from "@/lib/planning/today-service";
import type { DailyWorkspaceExpansionScope } from "@/lib/planning/types";
import { expandWeeklyRouteFromToday } from "@/lib/planning/weekly-route-service";
import { previewLessonDraftActivityPrompt } from "@/lib/learning-core/activity";
import { trackProductEvent } from "@/lib/platform/observability";
import { getLessonEvaluationLabel, type LessonEvaluationLevel } from "@/lib/session-workspace/evaluation";
import { recordSessionEvaluation } from "@/lib/session-workspace/service";
import { generateTodayActivity } from "@/lib/planning/today-activity-generation";
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

export interface TodayPlanItemEvaluationResult {
  ok: boolean;
  planItemId: string;
  evaluation?: {
    level: LessonEvaluationLevel;
    label: string;
    note: string | null;
    createdAt: string;
  };
  error?: string;
}

export interface TodayLessonSupportResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export interface TodayRouteExpansionResult extends TodayLessonSupportResult {
  status?: "expanded" | "already_scheduled" | "blocked";
  scheduledCount?: number;
  scheduledDates?: string[];
}

function getExpansionScopeLabel(scope: DailyWorkspaceExpansionScope) {
  switch (scope) {
    case "tomorrow":
      return "tomorrow";
    case "next_few_days":
      return "the next few days";
    case "current_week":
      return "the current week";
  }
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

    const workspaceResult = await getTodayWorkspace({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date,
    });

    if (!workspaceResult) return { ok: false, error: "Workspace not found" };

    const activityState = workspaceResult.workspace.activityState;
    return {
      ok: true,
      status: activityState?.status ?? "no_draft",
      sessionId: activityState?.sessionId,
      activityId: activityState?.activityId,
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

export async function saveTodayPlanItemEvaluationAction(input: {
  date: string;
  planItemId: string;
  level: LessonEvaluationLevel;
  note?: string;
}): Promise<TodayPlanItemEvaluationResult> {
  try {
    const session = await requireAppSession();
    const workspace = await getTodayWorkspace({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date: input.date,
    });

    if (!workspace) {
      return { ok: false, planItemId: input.planItemId, error: "Workspace not found." };
    }

    const item = workspace.workspace.items.find((candidate) => candidate.id === input.planItemId);
    if (!item) {
      return { ok: false, planItemId: input.planItemId, error: "Lesson card not found." };
    }

    if (!item.planRecordId || !item.sessionRecordId) {
      return {
        ok: false,
        planItemId: input.planItemId,
        error: "Session record not found for this lesson card.",
      };
    }

    const evaluation = await recordSessionEvaluation({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      planItemId: item.planRecordId,
      lessonSessionId: item.sessionRecordId,
      evaluationLevel: input.level,
      note: input.note ?? null,
      metadata: {
        source: "today_workspace_evaluation",
        weeklyRouteItemId: item.id,
        date: input.date,
      },
    });

    revalidatePath("/today");
    revalidatePath("/planning");
    revalidatePath("/tracking");
    revalidatePath("/tracking/reports");

    return {
      ok: true,
      planItemId: input.planItemId,
      evaluation: {
        level: evaluation.evaluationLevel,
        label: getLessonEvaluationLabel(evaluation.evaluationLevel),
        note: evaluation.note,
        createdAt: evaluation.createdAt,
      },
    };
  } catch (err) {
    console.error("[saveTodayPlanItemEvaluationAction]", err);
    return {
      ok: false,
      planItemId: input.planItemId,
      error: err instanceof Error ? err.message : "Could not save this evaluation.",
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
  input: {
    date: string;
    trigger?: "after_lesson_auto" | "today_resume" | "manual";
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireAppSession();
    await generateTodayActivity({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date: input.date,
      trigger: input.trigger ?? "manual",
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

    const preview = await previewLessonDraftActivityPrompt({
      lessonDraft,
      learnerName: session.activeLearner.displayName,
      workflowMode,
      planItems: workspaceResult.workspace.items,
    });
    return { ok: true, systemPrompt: preview.system_prompt, userPrompt: preview.user_prompt };
  } catch (err) {
    console.error("[getLessonDraftPromptPreviewAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to build prompt" };
  }
}

export async function saveLessonRegenerationNoteAction(input: {
  date: string;
  note: string;
}): Promise<TodayLessonSupportResult> {
  try {
    const session = await requireAppSession();
    const workspaceResult = await getTodayWorkspace({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date: input.date,
    });

    if (!workspaceResult) {
      return { ok: false, error: "Workspace not found." };
    }

    await saveTodayLessonRegenerationNote({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      date: input.date,
      sourceId: workspaceResult.sourceId,
      routeFingerprint: workspaceResult.workspace.items.map((item) => item.id).join("::"),
      note: input.note.trim().length > 0 ? input.note.trim() : null,
    });

    revalidatePath("/today");

    return { ok: true, message: "Saved note for the next regenerate." };
  } catch (error) {
    console.error("[saveLessonRegenerationNoteAction]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save the regeneration note.",
    };
  }
}

export async function saveExpansionIntentAction(input: {
  date: string;
  intent: "keep_today" | "expand_from_here";
}): Promise<TodayLessonSupportResult> {
  try {
    const session = await requireAppSession();
    const workspaceResult = await getTodayWorkspace({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date: input.date,
    });

    if (!workspaceResult) {
      return { ok: false, error: "Workspace not found." };
    }

    await saveTodayExpansionIntent({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      date: input.date,
      sourceId: workspaceResult.sourceId,
      routeFingerprint: workspaceResult.workspace.items.map((item) => item.id).join("::"),
      intent: input.intent,
    });

    revalidatePath("/today");
    revalidatePath("/planning");

    return {
      ok: true,
      message:
        input.intent === "keep_today"
          ? "Saved: keep this launch flow bounded to today."
          : "Saved: expand from here when you are ready to schedule more days.",
    };
  } catch (error) {
    console.error("[saveExpansionIntentAction]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save the expansion preference.",
    };
  }
}

export async function expandTodayRouteAction(input: {
  date: string;
  scope: DailyWorkspaceExpansionScope;
}): Promise<TodayRouteExpansionResult> {
  try {
    const session = await requireAppSession();
    const workspaceResult = await getTodayWorkspace({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date: input.date,
    });

    if (!workspaceResult) {
      return { ok: false, error: "Workspace not found." };
    }

    const sourceId = workspaceResult.sourceId;
    if (!sourceId) {
      return { ok: false, error: "No live curriculum source was found for this learner." };
    }

    const result = await expandWeeklyRouteFromToday({
      learnerId: session.activeLearner.id,
      sourceId,
      date: input.date,
      scope: input.scope,
    });

    revalidatePath("/today");
    revalidatePath("/planning");

    const metadata = {
      sourceId,
      date: input.date,
      scope: input.scope,
      targetDates: result.targetDates,
      scheduledDates: result.scheduledDates,
      scheduledCount: result.scheduledCount,
      reason: result.reason,
    };

    if (result.status === "expanded") {
      await trackProductEvent({
        name: ACTIVATION_EVENT_NAMES.routeExpansionApplied,
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        metadata,
      }).catch((error) => {
        console.error("[expandTodayRouteAction:routeExpansionApplied]", error);
      });

      return {
        ok: true,
        status: result.status,
        scheduledCount: result.scheduledCount,
        scheduledDates: result.scheduledDates,
        message:
          result.scheduledCount === 1
            ? `Scheduled the next route item for ${getExpansionScopeLabel(input.scope)}.`
            : `Scheduled ${result.scheduledCount} more route items for ${getExpansionScopeLabel(input.scope)}.`,
      };
    }

    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.routeExpansionBlocked,
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      metadata,
    }).catch((error) => {
      console.error("[expandTodayRouteAction:routeExpansionBlocked]", error);
    });

    return {
      ok: true,
      status: result.status,
      scheduledCount: result.scheduledCount,
      scheduledDates: result.scheduledDates,
      message: result.reason,
    };
  } catch (error) {
    console.error("[expandTodayRouteAction]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not expand the route.",
    };
  }
}
