import type {
  DailyWorkspace,
  DailyWorkspaceActivityBuild,
  DailyWorkspaceActivityState,
  DailyWorkspaceLessonBuild,
  DailyWorkspaceLessonDraft,
} from "@/lib/planning/types";
import type {
  TodayPlanItemActionResult,
  TodayPlanItemEvaluationResult,
  TodayWorkspacePatch,
} from "@/app/(parent)/today/actions";

function withLeadItem(workspace: DailyWorkspace, items: DailyWorkspace["items"]) {
  return {
    ...workspace,
    items,
    leadItem: items[0] ?? workspace.leadItem,
  };
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
