"use server";

import { revalidatePath } from "next/cache";

import { requireAppSession } from "@/lib/app-session/server";
import { getLearnerComplianceProgram, saveSessionEvidenceToPortfolio } from "@/lib/compliance/service";
import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import {
  getTodayBuildStatus,
  getTodayWorkspaceViewForRender,
  saveTodayExpansionIntent,
  saveTodayLessonRegenerationNote,
} from "@/lib/planning/today-service";
import type {
  DailyWorkspace,
  DailyWorkspaceActivityBuild,
  DailyWorkspaceActivityState,
  DailyWorkspaceExpansionIntent,
  DailyWorkspaceExpansionScope,
} from "@/lib/planning/types";
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
  itemPatch?: Partial<Pick<DailyWorkspace["items"][number], "status" | "completionStatus" | "reviewState">>;
  optimisticPatch?: {
    removePlanItemIds?: string[];
  };
  needsWorkspacePatch?: boolean;
  requiresWorkspaceRefresh?: boolean;
  workspacePatch?: TodayWorkspacePatch;
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

export interface TodayPlanItemPortfolioResult {
  ok: boolean;
  planItemId: string;
  message?: string;
  error?: string;
}

export interface TodayLessonSupportResult {
  ok: boolean;
  note?: string | null;
  intent?: DailyWorkspaceExpansionIntent | null;
  message?: string;
  error?: string;
}

export interface TodayRouteExpansionResult extends TodayLessonSupportResult {
  status?: "expanded" | "already_scheduled" | "blocked";
  scheduledCount?: number;
  scheduledDates?: string[];
  workspacePatch?: TodayWorkspacePatch;
}

export interface TodayWorkspacePatch {
  workspace: DailyWorkspace;
  sourceId: string;
  routeFingerprint: string;
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
  input: {
    date: string;
    sourceId: string;
    routeFingerprint: string;
    lessonSessionId?: string | null;
  },
): Promise<LessonDraftActivityState> {
  try {
    const session = await requireAppSession();
    const status = await getTodayBuildStatus({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      date: input.date,
      sourceId: input.sourceId,
      routeFingerprint: input.routeFingerprint,
      lessonSessionId: input.lessonSessionId,
    });

    return {
      ok: true,
      status: status.activityState.status ?? "no_draft",
      sessionId: status.activityState.sessionId,
      activityId: status.activityState.activityId,
    };
  } catch (err) {
    console.error("[getLessonDraftActivityStatusAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Status check failed" };
  }
}

async function loadTodayWorkspacePatch(input: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}) {
  const workspaceResult = await getTodayWorkspaceViewForRender(input);
  if (!workspaceResult) {
    return null;
  }

  return {
    workspace: workspaceResult.workspace,
    sourceId: workspaceResult.sourceId,
    routeFingerprint: workspaceResult.routeFingerprint,
  } satisfies TodayWorkspacePatch;
}

export async function updateTodayPlanItemAction(input: {
  date: string;
  planItemId: string;
  action: TodayPlanItemAction;
  alternateWeeklyRouteItemId?: string;
  planParentId?: string | null;
  planDayRecordId?: string | null;
  planRecordId?: string | null;
  sessionRecordId?: string | null;
  estimatedMinutes?: number | null;
  title?: string | null;
}): Promise<TodayPlanItemActionResult> {
  try {
    const session = await requireAppSession();

    if (input.action === "complete") {
      await completeTodayPlanItem({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        weeklyRouteItemId: input.planItemId,
        date: input.date,
        planParentId: input.planParentId,
        planDayRecordId: input.planDayRecordId,
        planRecordId: input.planRecordId,
        estimatedMinutes: input.estimatedMinutes,
        title: input.title,
      });
    } else if (input.action === "reset") {
      await resetTodayPlanItem({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        weeklyRouteItemId: input.planItemId,
        date: input.date,
        planRecordId: input.planRecordId,
        sessionRecordId: input.sessionRecordId,
      });
    } else if (input.action === "partial") {
      await partiallyCompleteTodayPlanItem({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        weeklyRouteItemId: input.planItemId,
        date: input.date,
        planParentId: input.planParentId,
        planDayRecordId: input.planDayRecordId,
        planRecordId: input.planRecordId,
        estimatedMinutes: input.estimatedMinutes,
        title: input.title,
      });
    } else if (input.action === "skip_today") {
      await skipTodayPlanItem({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        weeklyRouteItemId: input.planItemId,
        date: input.date,
        planParentId: input.planParentId,
        planDayRecordId: input.planDayRecordId,
        planRecordId: input.planRecordId,
        estimatedMinutes: input.estimatedMinutes,
        title: input.title,
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

    const structuralAction =
      input.action === "partial" ||
      input.action === "push_to_tomorrow" ||
      input.action === "skip_today" ||
      input.action === "swap_with_alternate";

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
      itemPatch:
        input.action === "complete"
          ? {
              status: "completed",
              completionStatus: "completed_as_planned",
              reviewState: "not_required",
            }
          : input.action === "reset"
            ? {
                status: "ready",
                completionStatus: "not_started",
                reviewState: "not_required",
              }
            : undefined,
      optimisticPatch: structuralAction
        ? {
            removePlanItemIds: [input.planItemId],
          }
        : undefined,
      needsWorkspacePatch: structuralAction,
      // Back-compat for existing client code while the Today runtime finishes converging on the
      // narrower "workspace patch" terminology.
      requiresWorkspaceRefresh: structuralAction,
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
  weeklyRouteItemId: string;
  planRecordId: string;
  sessionRecordId: string;
  level: LessonEvaluationLevel;
  note?: string;
}): Promise<TodayPlanItemEvaluationResult> {
  try {
    const session = await requireAppSession();
    const evaluation = await recordSessionEvaluation({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      planItemId: input.planRecordId,
      lessonSessionId: input.sessionRecordId,
      evaluationLevel: input.level,
      note: input.note ?? null,
      metadata: {
        surface: "today_workspace",
        weeklyRouteItemId: input.weeklyRouteItemId,
        date: input.date,
      },
    });

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

export async function saveTodayPlanItemPortfolioAction(input: {
  planItemId: string;
  sessionRecordId: string;
}): Promise<TodayPlanItemPortfolioResult> {
  try {
    const session = await requireAppSession();
    const program = await getLearnerComplianceProgram({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
    });

    await saveSessionEvidenceToPortfolio({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      lessonSessionId: input.sessionRecordId,
      complianceProgramId: program.id,
    });

    return {
      ok: true,
      planItemId: input.planItemId,
      message: "Saved to portfolio.",
    };
  } catch (err) {
    console.error("[saveTodayPlanItemPortfolioAction]", err);
    return {
      ok: false,
      planItemId: input.planItemId,
      error: err instanceof Error ? err.message : "Could not save this lesson to the portfolio.",
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
    sourceId: string;
    routeFingerprint: string;
    lessonSessionId?: string | null;
    trigger?: "after_lesson_auto" | "today_resume" | "manual";
  },
): Promise<{
  ok: boolean;
  build?: DailyWorkspaceActivityBuild | null;
  activityState?: DailyWorkspaceActivityState;
  error?: string;
}> {
  try {
    const session = await requireAppSession();
    await generateTodayActivity({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date: input.date,
      trigger: input.trigger ?? "manual",
    });

    const status = await getTodayBuildStatus({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      date: input.date,
      sourceId: input.sourceId,
      routeFingerprint: input.routeFingerprint,
      lessonSessionId: input.lessonSessionId,
    });

    return { ok: true, build: status.activityBuild, activityState: status.activityState };
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

    const workspaceResult = await getTodayWorkspaceViewForRender({
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
  sourceId: string;
  routeFingerprint: string;
  note: string;
}): Promise<TodayLessonSupportResult> {
  try {
    const session = await requireAppSession();
    const note = input.note.trim().length > 0 ? input.note.trim() : null;

    await saveTodayLessonRegenerationNote({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      date: input.date,
      sourceId: input.sourceId,
      routeFingerprint: input.routeFingerprint,
      note,
    });

    return { ok: true, note, message: "Saved note for the next regenerate." };
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
  sourceId: string;
  routeFingerprint: string;
  intent: "keep_today" | "expand_from_here";
}): Promise<TodayLessonSupportResult> {
  try {
    const session = await requireAppSession();

    await saveTodayExpansionIntent({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      date: input.date,
      sourceId: input.sourceId,
      routeFingerprint: input.routeFingerprint,
      intent: input.intent,
    });

    return {
      ok: true,
      intent: input.intent,
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
  sourceId: string;
  scope: DailyWorkspaceExpansionScope;
}): Promise<TodayRouteExpansionResult> {
  try {
    const session = await requireAppSession();
    if (!input.sourceId) {
      return { ok: false, error: "No live curriculum source was found for this learner." };
    }

    const result = await expandWeeklyRouteFromToday({
      learnerId: session.activeLearner.id,
      sourceId: input.sourceId,
      date: input.date,
      scope: input.scope,
    });

    const metadata = {
      sourceId: input.sourceId,
      date: input.date,
      scope: input.scope,
      targetDates: result.targetDates,
      scheduledDates: result.scheduledDates,
      scheduledCount: result.scheduledCount,
      reason: result.reason,
    };

    if (result.status === "expanded") {
      // This is the one Today action that changes the surrounding schedule structure enough to
      // matter to other server-rendered surfaces beyond the local client patch.
      revalidatePath("/today");
      revalidatePath("/planning");

      await trackProductEvent({
        name: ACTIVATION_EVENT_NAMES.routeExpansionApplied,
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        metadata,
      }).catch((error) => {
        console.error("[expandTodayRouteAction:routeExpansionApplied]", error);
      });

      const workspacePatch = await loadTodayWorkspacePatch({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        learnerName: session.activeLearner.displayName,
        date: input.date,
      });

      return {
        ok: true,
        status: result.status,
        scheduledCount: result.scheduledCount,
        scheduledDates: result.scheduledDates,
        workspacePatch: workspacePatch ?? undefined,
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
