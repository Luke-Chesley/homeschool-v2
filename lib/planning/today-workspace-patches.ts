import type {
  DailyWorkspace,
  DailyWorkspaceActivityBuild,
  DailyWorkspaceActivityState,
  DailyWorkspaceExpansionIntent,
  DailyWorkspaceLessonBuild,
  DailyWorkspaceLessonDraft,
} from "@/lib/planning/types";
import type {
  TodayPlanItemActionResult,
  TodayPlanItemEvaluationResult,
  TodayWorkspacePatch,
} from "@/app/(parent)/today/actions";

export interface TodayWorkspaceSlotState {
  lessonDraft?: DailyWorkspaceLessonDraft | null;
  lessonBuild?: DailyWorkspaceLessonBuild | null;
  activityBuild?: DailyWorkspaceActivityBuild | null;
  activityState?: DailyWorkspaceActivityState | null;
  lessonRegenerationNote?: string | null;
  expansionIntent?: DailyWorkspaceExpansionIntent | null;
}

export interface TodayWorkspaceSlotSummary {
  id: string;
  title: string;
  subject: string;
  estimatedMinutes: number;
  hasDraft: boolean;
  lessonBuildStatus: DailyWorkspaceLessonBuild["status"] | null;
  activityStatus: DailyWorkspaceActivityState["status"] | null;
}

function withLeadItem(workspace: DailyWorkspace, items: DailyWorkspace["items"]) {
  return {
    ...workspace,
    items,
    leadItem: items[0] ?? workspace.leadItem,
  };
}

export function buildTodaySlotRouteFingerprint(slotId: string) {
  return `slot:${slotId}`;
}

export function getTodayWorkspaceSlot(
  workspace: DailyWorkspace,
  preferredSlotId?: string | null,
) {
  if (preferredSlotId) {
    const directMatch = workspace.slots.find((slot) => slot.id === preferredSlotId);
    if (directMatch) {
      return directMatch;
    }

    const itemMatch = workspace.slots.find(
      (slot) =>
        slot.leadItem.id === preferredSlotId || slot.items.some((item) => item.id === preferredSlotId),
    );
    if (itemMatch) {
      return itemMatch;
    }
  }

  if (workspace.leadItem.planDaySlotId) {
    const leadSlot = workspace.slots.find((slot) => slot.id === workspace.leadItem.planDaySlotId);
    if (leadSlot) {
      return leadSlot;
    }
  }

  return workspace.slots[0] ?? null;
}

export function resolveTodayWorkspaceSlotId(
  workspace: DailyWorkspace,
  preferredSlotId?: string | null,
) {
  return getTodayWorkspaceSlot(workspace, preferredSlotId)?.id ?? null;
}

export function resolveTodayWorkspaceSlotRouteFingerprint(
  workspace: DailyWorkspace,
  preferredSlotId?: string | null,
  slotState?: TodayWorkspaceSlotState,
) {
  return (
    slotState?.lessonBuild?.routeFingerprint ??
    slotState?.lessonDraft?.routeFingerprint ??
    slotState?.activityBuild?.routeFingerprint ??
    getTodayWorkspaceSlot(workspace, preferredSlotId)?.routeFingerprint ??
    null
  );
}

export function buildTodayWorkspaceSlotState(
  workspace: DailyWorkspace,
  slotId: string | null,
): TodayWorkspaceSlotState {
  const slot = getTodayWorkspaceSlot(workspace, slotId);
  if (!slot) {
    return {};
  }

  return {
    lessonDraft: slot.lessonDraft,
    lessonBuild: slot.lessonBuild,
    activityBuild: slot.activityBuild,
    activityState: slot.activityState,
    lessonRegenerationNote: slot.lessonRegenerationNote,
    expansionIntent: slot.expansionIntent,
  };
}

export function buildTodaySlotWorkspace(
  workspace: DailyWorkspace,
  slotId: string | null,
  slotState?: TodayWorkspaceSlotState,
) {
  const slot = getTodayWorkspaceSlot(workspace, slotId);
  if (!slot) {
    return workspace;
  }

  return {
    ...workspace,
    leadItem: slot.leadItem,
    items: slot.items,
    prepChecklist: slot.prepChecklist,
    sessionTargets: slot.sessionTargets,
    artifactSlots: slot.artifactSlots,
    lessonDraft:
      slotState?.lessonDraft === undefined
        ? slot.lessonDraft
        : slotState.lessonDraft,
    lessonBuild:
      slotState?.lessonBuild === undefined
        ? slot.lessonBuild
        : slotState.lessonBuild,
    activityBuild:
      slotState?.activityBuild === undefined
        ? slot.activityBuild
        : slotState.activityBuild,
    activityState:
      slotState?.activityState === undefined
        ? slot.activityState
        : slotState.activityState,
    lessonRegenerationNote:
      slotState?.lessonRegenerationNote === undefined
        ? slot.lessonRegenerationNote
        : slotState.lessonRegenerationNote,
    expansionIntent:
      slotState?.expansionIntent === undefined
        ? slot.expansionIntent
        : slotState.expansionIntent,
  } satisfies DailyWorkspace;
}

export function buildTodayWorkspaceSlotSummaries(
  workspace: DailyWorkspace,
  slotStates: Record<string, TodayWorkspaceSlotState>,
) {
  return workspace.slots.map((slot) => {
    const state = slotStates[slot.id];
    const hasDraft =
      state?.lessonDraft !== undefined
        ? Boolean(state.lessonDraft)
        : Boolean(slot.lessonDraft);
    const lessonBuildStatus =
      state?.lessonBuild !== undefined
        ? state.lessonBuild?.status ?? null
        : slot.lessonBuild?.status ?? null;
    const activityStatus =
      state?.activityState !== undefined
        ? state.activityState?.status ?? null
        : slot.activityState?.status ?? null;
    const estimatedMinutes = slot.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);

    return {
      id: slot.id,
      title: slot.title,
      subject: slot.leadItem.subject,
      estimatedMinutes,
      hasDraft,
      lessonBuildStatus,
      activityStatus,
    } satisfies TodayWorkspaceSlotSummary;
  });
}

export function applyTodayWorkspacePatch(
  current: DailyWorkspace,
  patch?: TodayWorkspacePatch | null,
) {
  return patch?.workspace ?? current;
}

export function applyTodayPlanItemActionPatch(
  current: DailyWorkspace,
  result: TodayPlanItemActionResult,
) {
  if (result.workspacePatch) {
    return result.workspacePatch.workspace;
  }

  let nextWorkspace = current;

  if (result.optimisticPatch?.removePlanItemIds?.length) {
    const removePlanItemIds = new Set(result.optimisticPatch.removePlanItemIds);
    nextWorkspace = withLeadItem(
      nextWorkspace,
      nextWorkspace.items.filter((item) => !removePlanItemIds.has(item.id)),
    );
  }

  if (!result.itemPatch) {
    return nextWorkspace;
  }

  const items = nextWorkspace.items.map((item) =>
    item.id === result.planItemId ? { ...item, ...result.itemPatch } : item,
  );

  return withLeadItem(nextWorkspace, items);
}

export function applyTodayPlanItemEvaluationPatch(
  current: DailyWorkspace,
  result: TodayPlanItemEvaluationResult,
) {
  if (!result.evaluation) {
    return current;
  }

  const evaluation = result.evaluation;

  const items = current.items.map((item) =>
    item.id === result.planItemId
      ? {
          ...item,
          latestEvaluation: {
            level: evaluation.level,
            label: evaluation.label,
            note: evaluation.note ?? undefined,
            createdAt: evaluation.createdAt,
          },
        }
      : item,
  );

  return withLeadItem(current, items);
}

export function applyTodayLessonPatch(
  current: DailyWorkspace,
  patch: {
    lessonDraft?: DailyWorkspaceLessonDraft | null;
    lessonBuild?: DailyWorkspaceLessonBuild | null;
    activityBuild?: DailyWorkspaceActivityBuild | null;
  },
) {
  return {
    ...current,
    lessonDraft:
      patch.lessonDraft === undefined ? current.lessonDraft : patch.lessonDraft,
    lessonBuild:
      patch.lessonBuild === undefined ? current.lessonBuild : patch.lessonBuild,
    activityBuild:
      patch.activityBuild === undefined ? current.activityBuild : patch.activityBuild,
  };
}

export function applyTodayActivityPatch(
  current: DailyWorkspace,
  patch: {
    activityBuild?: DailyWorkspaceActivityBuild | null;
    activityState?: DailyWorkspaceActivityState | null;
  },
) {
  return {
    ...current,
    activityBuild:
      patch.activityBuild === undefined ? current.activityBuild : patch.activityBuild,
    activityState:
      patch.activityState === undefined ? current.activityState : patch.activityState,
  };
}

export function applyTodayBuildStatusPatch(
  current: DailyWorkspace,
  patch: {
    lessonBuild?: DailyWorkspaceLessonBuild | null;
    lessonDraft?: DailyWorkspaceLessonDraft | null;
    activityBuild?: DailyWorkspaceActivityBuild | null;
    activityState?: DailyWorkspaceActivityState | null;
  },
) {
  return {
    ...current,
    lessonBuild:
      patch.lessonBuild === undefined ? current.lessonBuild : patch.lessonBuild,
    lessonDraft:
      patch.lessonDraft === undefined ? current.lessonDraft : patch.lessonDraft,
    activityBuild:
      patch.activityBuild === undefined ? current.activityBuild : patch.activityBuild,
    activityState:
      patch.activityState === undefined ? current.activityState : patch.activityState,
  };
}
