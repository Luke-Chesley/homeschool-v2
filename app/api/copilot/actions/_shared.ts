import "@/lib/server-only";

import { revalidatePath } from "next/cache";

import { requireAppApiSession } from "@/lib/app-session/server";
import { getCopilotStore } from "@/lib/ai/copilot-store";
import {
  CopilotActionMutationRequestSchema,
  CopilotActionSchema,
  type CopilotAction,
} from "@/lib/ai/types";
import { generateTodayLessonDraft } from "@/lib/planning/today-lesson-generation";
import { getTodayWorkspaceViewForRender } from "@/lib/planning/today-service";
import { moveWeeklyRouteItem } from "@/lib/planning/weekly-route-service";
import { recordObservationNote } from "@/lib/tracking/service";

function dedupePaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))];
}

function revalidateCopilotPaths(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function loadAuthorizedCopilotAction(body: unknown) {
  const parsed = CopilotActionMutationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400,
      error: "Invalid request body.",
      issues: parsed.error.flatten(),
    };
  }

  const session = await requireAppApiSession();
  const store = getCopilotStore();
  const copilotSession = await store.getSession(parsed.data.sessionId, {
    householdId: session.organization.id,
    learnerId: session.activeLearner.id,
  });

  if (!copilotSession) {
    return {
      ok: false as const,
      status: 404,
      error: "Copilot session not found.",
    };
  }

  const rawAction = copilotSession.actions.find((action) => action.id === parsed.data.actionId);
  if (!rawAction) {
    return {
      ok: false as const,
      status: 404,
      error: "Copilot action not found.",
    };
  }

  const action = CopilotActionSchema.safeParse(rawAction);
  if (!action.success) {
    return {
      ok: false as const,
      status: 409,
      error: "Copilot action uses an unsupported or stale shape.",
      issues: action.error.flatten(),
    };
  }

  return {
    ok: true as const,
    session,
    request: parsed.data,
    action: action.data,
    store,
  };
}

async function applyPlanningMoveAction(session: Awaited<ReturnType<typeof requireAppApiSession>>, action: CopilotAction) {
  if (
    action.kind !== "planning.adjust_day_load" &&
    action.kind !== "planning.defer_or_move_item"
  ) {
    throw new Error(`Unsupported planning action kind: ${action.kind}`);
  }

  await moveWeeklyRouteItem({
    learnerId: session.activeLearner.id,
    weeklyRouteId: action.payload.weeklyRouteId,
    weeklyRouteItemId: action.payload.weeklyRouteItemId,
    targetScheduledDate: action.payload.targetDate ?? null,
    targetIndex: action.payload.targetIndex,
    manualOverrideNote: action.payload.reason,
  });

  const affectedPaths = dedupePaths([
    "/copilot",
    "/planning",
    "/today",
    action.payload.currentDate ? `/planning/day/${action.payload.currentDate}` : null,
    action.payload.targetDate ? `/planning/day/${action.payload.targetDate}` : null,
  ]);
  revalidateCopilotPaths(affectedPaths);

  return {
    message:
      action.payload.targetDate == null
        ? "Deferred the selected weekly route item."
        : `Moved the selected weekly route item to ${action.payload.targetDate}.`,
    affectedPaths,
    data: {
      weeklyRouteId: action.payload.weeklyRouteId,
      weeklyRouteItemId: action.payload.weeklyRouteItemId,
      targetDate: action.payload.targetDate ?? null,
      targetIndex: action.payload.targetIndex,
    },
  } satisfies NonNullable<CopilotAction["result"]>;
}

async function applyGenerateTodayLessonAction(
  session: Awaited<ReturnType<typeof requireAppApiSession>>,
  action: CopilotAction,
) {
  if (action.kind !== "planning.generate_today_lesson") {
    throw new Error(`Unsupported planning action kind: ${action.kind}`);
  }

  const workspaceResult = await getTodayWorkspaceViewForRender({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    date: action.payload.date,
  });

  if (!workspaceResult) {
    throw new Error(`No Today workspace was found for ${action.payload.date}.`);
  }

  const result = await generateTodayLessonDraft({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    date: action.payload.date,
    slotId: action.payload.slotId ?? undefined,
    trigger: "manual",
    forceRegenerate: true,
  });

  const affectedPaths = dedupePaths([
    "/copilot",
    "/today",
    "/planning",
    `/planning/day/${action.payload.date}`,
  ]);
  revalidateCopilotPaths(affectedPaths);

  return {
    message: result.reusedExistingDraft
      ? "Reused the current lesson draft for today."
      : "Generated the lesson draft for today.",
    affectedPaths,
    data: {
      artifactId: result.artifactId,
      date: result.date,
      slotId: result.slotId ?? null,
      sourceId: workspaceResult.sourceId,
      routeFingerprint: result.routeFingerprint,
    },
  } satisfies NonNullable<CopilotAction["result"]>;
}

async function applyTrackingRecordNoteAction(
  session: Awaited<ReturnType<typeof requireAppApiSession>>,
  action: CopilotAction,
) {
  if (action.kind !== "tracking.record_note") {
    throw new Error(`Unsupported tracking action kind: ${action.kind}`);
  }

  const note = await recordObservationNote({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    authorAdultUserId: session.adultUser.id,
    noteType: action.payload.noteType,
    body: action.payload.body,
    title: action.payload.title ?? action.label,
    planItemId: action.payload.planItemId ?? null,
    lessonSessionId: action.payload.lessonSessionId ?? null,
    metadata: {
      source: "copilot_action",
      requiresApproval: action.requiresApproval,
    },
  });

  const affectedPaths = ["/copilot", "/tracking"];
  revalidateCopilotPaths(affectedPaths);

  return {
    message: "Saved the note to tracking.",
    affectedPaths,
    data: {
      noteId: note.id,
      noteType: note.noteType,
      lessonSessionId: note.lessonSessionId,
      planItemId: note.planItemId,
    },
  } satisfies NonNullable<CopilotAction["result"]>;
}

export async function dispatchCopilotAction(
  session: Awaited<ReturnType<typeof requireAppApiSession>>,
  action: CopilotAction,
) {
  switch (action.kind) {
    case "planning.adjust_day_load":
    case "planning.defer_or_move_item":
      return applyPlanningMoveAction(session, action);
    case "planning.generate_today_lesson":
      return applyGenerateTodayLessonAction(session, action);
    case "tracking.record_note":
      return applyTrackingRecordNoteAction(session, action);
  }
}
