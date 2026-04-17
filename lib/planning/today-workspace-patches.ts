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

  if (!result.itemPatch) {
    return current;
  }

  const items = current.items.map((item) =>
    item.id === result.planItemId ? { ...item, ...result.itemPatch } : item,
  );

  return withLeadItem(current, items);
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
