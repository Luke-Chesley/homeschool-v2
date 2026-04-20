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

export function resolveTodayWorkspaceSlotId(
  workspace: DailyWorkspace,
  preferredSlotId?: string | null,
) {
  if (preferredSlotId && workspace.items.some((item) => item.id === preferredSlotId)) {
    return preferredSlotId;
  }

  return workspace.items[0]?.id ?? null;
}

export function buildTodayWorkspaceSlotState(
  workspace: DailyWorkspace,
  slotId: string | null,
): TodayWorkspaceSlotState {
  if (!slotId || workspace.leadItem.id !== slotId) {
    return {};
  }

  return {
    lessonDraft: workspace.lessonDraft,
    lessonBuild: workspace.lessonBuild,
    activityBuild: workspace.activityBuild,
    activityState: workspace.activityState,
    lessonRegenerationNote: workspace.lessonRegenerationNote,
    expansionIntent: workspace.expansionIntent,
  };
}

export function buildTodaySlotWorkspace(
  workspace: DailyWorkspace,
  slotId: string | null,
  slotState?: TodayWorkspaceSlotState,
) {
  const resolvedSlotId = resolveTodayWorkspaceSlotId(workspace, slotId);
  if (!resolvedSlotId) {
    return workspace;
  }

  const selectedItem =
    workspace.items.find((item) => item.id === resolvedSlotId) ?? workspace.leadItem;
  const isLeadSlot = workspace.leadItem.id === selectedItem.id;

  return {
    ...workspace,
    leadItem: selectedItem,
    items: [selectedItem],
    sessionTargets: selectedItem.objective ? [selectedItem.objective] : [],
    lessonDraft:
      slotState?.lessonDraft === undefined
        ? isLeadSlot
          ? workspace.lessonDraft
          : null
        : slotState.lessonDraft,
    lessonBuild:
      slotState?.lessonBuild === undefined
        ? isLeadSlot
          ? workspace.lessonBuild
          : null
        : slotState.lessonBuild,
    activityBuild:
      slotState?.activityBuild === undefined
        ? isLeadSlot
          ? workspace.activityBuild
          : null
        : slotState.activityBuild,
    activityState:
      slotState?.activityState === undefined
        ? isLeadSlot
          ? workspace.activityState
          : null
        : slotState.activityState,
    lessonRegenerationNote:
      slotState?.lessonRegenerationNote === undefined
        ? isLeadSlot
          ? workspace.lessonRegenerationNote
          : null
        : slotState.lessonRegenerationNote,
    expansionIntent:
      slotState?.expansionIntent === undefined
        ? isLeadSlot
          ? workspace.expansionIntent
          : null
        : slotState.expansionIntent,
  } satisfies DailyWorkspace;
}

export function buildTodayWorkspaceSlotSummaries(
  workspace: DailyWorkspace,
  slotStates: Record<string, TodayWorkspaceSlotState>,
) {
  return workspace.items.map((item) => {
    const state = slotStates[item.id];
    const hasDraft =
      state?.lessonDraft !== undefined
        ? Boolean(state.lessonDraft)
        : workspace.leadItem.id === item.id && Boolean(workspace.lessonDraft);
    const lessonBuildStatus =
      state?.lessonBuild !== undefined
        ? state.lessonBuild?.status ?? null
        : workspace.leadItem.id === item.id
          ? workspace.lessonBuild?.status ?? null
          : null;
    const activityStatus =
      state?.activityState !== undefined
        ? state.activityState?.status ?? null
        : workspace.leadItem.id === item.id
          ? workspace.activityState?.status ?? null
          : null;

    return {
      id: item.id,
      title: item.title,
      subject: item.subject,
      estimatedMinutes: item.estimatedMinutes,
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
