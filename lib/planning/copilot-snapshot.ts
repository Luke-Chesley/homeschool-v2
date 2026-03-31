import type {
  DailyWorkspaceSnapshot,
  CurriculumSnapshot,
  WeeklyPlanningSnapshot,
} from "@/lib/ai/types";
import type { WeeklyRouteBoard, WeeklyRouteBoardItem } from "@/lib/curriculum-routing";

type BuildCopilotPlanningContextParams = {
  board: WeeklyRouteBoard;
  learnerId: string;
  learnerName: string;
  sourceId: string;
  selectedDate?: string;
};

function parseDateOrThrow(value: string) {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return parsed;
}

function addDays(baseDate: string, days: number) {
  const date = parseDateOrThrow(baseDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildWeekDates(weekStartDate: string) {
  return Array.from({ length: 5 }, (_, index) => addDays(weekStartDate, index));
}

function formatWeekLabel(weekStartDate: string) {
  return `Week of ${new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(parseDateOrThrow(weekStartDate))}`;
}

function formatDayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(parseDateOrThrow(date));
}

function getBoardItemsForDate(board: WeeklyRouteBoard, date: string) {
  return board.items
    .filter((item) => item.scheduledDate === date)
    .sort((left, right) => left.currentPosition - right.currentPosition);
}

function getDailyLeadItem(items: WeeklyRouteBoardItem[], fallback: WeeklyRouteBoardItem[]) {
  return items[0] ?? fallback[0];
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function getSubjectFromPath(skillPath: string, fallback: string) {
  return skillPath.split("/")[0]?.trim() || fallback;
}

function buildCurriculumSnapshotFromBoard(
  board: WeeklyRouteBoard,
  items: WeeklyRouteBoardItem[],
): CurriculumSnapshot {
  return {
    sourceId: board.summary.sourceId,
    subjectFocus: uniqueStrings(items.map((item) => getSubjectFromPath(item.skillPath, item.skillTitle))),
    lessonLabels: uniqueStrings(items.map((item) => item.skillTitle)),
    skillNodeIds: uniqueStrings(items.map((item) => item.skillNodeId)),
    weeklyRouteItemIds: board.items.map((item) => item.id),
    todayHighlights: items
      .slice(0, 5)
      .map((item) => `${getSubjectFromPath(item.skillPath, item.skillTitle)}: ${item.skillTitle}`),
  };
}

function buildDailyWorkspaceSnapshotFromBoard(
  board: WeeklyRouteBoard,
  selectedDate: string,
): DailyWorkspaceSnapshot | undefined {
  const selectedItems = getBoardItemsForDate(board, selectedDate);
  const fallbackItems = [...board.items].sort((left, right) => left.currentPosition - right.currentPosition);
  const leadItem = getDailyLeadItem(selectedItems, fallbackItems);

  if (!leadItem) {
    return undefined;
  }

  const planItemsSource = selectedItems.length > 0 ? selectedItems : fallbackItems.slice(0, 4);

  return {
    date: selectedDate,
    headline: `Weekly route for ${formatWeekLabel(board.summary.weekStartDate)}`,
    leadLesson: {
      title: leadItem.skillTitle,
      subject: getSubjectFromPath(leadItem.skillPath, leadItem.skillTitle),
      objective: leadItem.skillPath,
      lessonLabel: `Route item ${leadItem.currentPosition + 1}`,
      estimatedMinutes: 30,
    },
    planItems: planItemsSource.map((item) => ({
      title: item.skillTitle,
      subject: getSubjectFromPath(item.skillPath, item.skillTitle),
      objective: item.skillPath,
      lessonLabel: `Route item ${item.currentPosition + 1}`,
      status: item.state,
      estimatedMinutes: 30,
      materials: [],
      copilotPrompts: [
        item.manualOverrideKind !== "none"
          ? `This item was ${item.manualOverrideKind.replace("_", " ")}`
          : "Follow the weekly route order",
      ],
    })),
    prepChecklist: [
      "Review the scheduled route order before starting.",
      "Check for deferred or pinned items that changed the original recommendation.",
      "Keep any conflict explanations visible while planning the day.",
    ],
    sessionTargets: [
      `${selectedItems.length > 0 ? "Work the current day's route items" : "Review the week's persisted route items"}`,
      "Capture one concrete note about any reordered or pinned item.",
    ],
    copilotInsertions: uniqueStrings([
      ...board.items
        .filter((item) => item.manualOverrideKind !== "none")
        .map((item) => `${item.skillTitle}: ${item.manualOverrideKind.replace("_", " ")}`),
      ...board.conflicts.map((conflict) => conflict.explanation),
    ]),
    completionPrompts: [
      "Which route items actually happened?",
      "What moved, and why?",
      "What should carry into tomorrow?",
    ],
    familyNotes: [
      `Route summary: ${board.summary.doneItems} done, ${board.summary.queuedItems} queued, ${board.summary.removedItems} removed.`,
    ],
  };
}

function buildWeeklyPlanningSnapshot(
  board: WeeklyRouteBoard,
  learnerId: string,
  learnerName: string,
): WeeklyPlanningSnapshot {
  const weekDates = buildWeekDates(board.summary.weekStartDate);
  const orderedItems = [...board.items].sort((left, right) => left.currentPosition - right.currentPosition);

  return {
    weekStartDate: board.summary.weekStartDate,
    weekLabel: formatWeekLabel(board.summary.weekStartDate),
    weeklyRouteId: board.summary.weeklyRouteId,
    sourceId: board.summary.sourceId,
    learnerId,
    learnerName,
    summary: {
      itemCount: board.items.length,
      scheduledCount: board.items.filter((item) => item.scheduledDate != null).length,
      unassignedCount: board.items.filter((item) => item.scheduledDate == null).length,
      conflictCount: board.conflicts.length,
      reorderedCount: board.items.filter((item) => item.manualOverrideKind === "reordered").length,
      pinnedCount: board.items.filter((item) => item.manualOverrideKind === "pinned").length,
      deferredCount: board.items.filter((item) => item.manualOverrideKind === "deferred").length,
    },
    days: weekDates.map((date) => {
      const items = getBoardItemsForDate(board, date);
      return {
        date,
        label: formatDayLabel(date),
        itemIds: items.map((item) => item.id),
        itemTitles: items.map((item) => item.skillTitle),
        scheduledMinutes: items.length * 30,
      };
    }),
    items: orderedItems.map((item) => ({
      id: item.id,
      skillTitle: item.skillTitle,
      skillPath: item.skillPath,
      subject: getSubjectFromPath(item.skillPath, item.skillTitle),
      recommendedPosition: item.recommendedPosition,
      currentPosition: item.currentPosition,
      scheduledDate: item.scheduledDate,
      manualOverrideKind: item.manualOverrideKind,
      manualOverrideNote: item.manualOverrideNote,
      state: item.state,
    })),
    conflicts: board.conflicts.map((conflict) => ({
      type: conflict.type,
      explanation: conflict.explanation,
      affectedItemIds: conflict.affectedItemIds,
      keepOverrideAllowed: conflict.keepOverrideAllowed,
    })),
    highlights: orderedItems
      .slice(0, 5)
      .map((item) => `${getSubjectFromPath(item.skillPath, item.skillTitle)}: ${item.skillTitle}`),
  };
}

export function buildCopilotPlanningContext(params: BuildCopilotPlanningContextParams): {
  curriculumSnapshot: CurriculumSnapshot;
  dailyWorkspaceSnapshot: DailyWorkspaceSnapshot;
  weeklyPlanningSnapshot: WeeklyPlanningSnapshot;
  feedbackNotes: string[];
} | null {
  if (params.board.items.length === 0) {
    return null;
  }

  const selectedDate = params.selectedDate ?? params.board.summary.weekStartDate;
  const dailyItems = getBoardItemsForDate(params.board, selectedDate);
  const dailyWorkspaceSnapshot =
    buildDailyWorkspaceSnapshotFromBoard(params.board, selectedDate) ??
    buildDailyWorkspaceSnapshotFromBoard(params.board, params.board.summary.weekStartDate);

  if (!dailyWorkspaceSnapshot) {
    return null;
  }

  const weeklyPlanningSnapshot = buildWeeklyPlanningSnapshot(
    params.board,
    params.learnerId,
    params.learnerName,
  );
  const curriculumSnapshot = buildCurriculumSnapshotFromBoard(
    params.board,
    dailyItems.length > 0 ? dailyItems : params.board.items,
  );

  const feedbackNotes = uniqueStrings([
    ...params.board.conflicts.map((conflict) => conflict.explanation),
    ...params.board.items
      .filter((item) => item.manualOverrideNote)
      .map((item) => item.manualOverrideNote),
  ]);

  return {
    curriculumSnapshot,
    dailyWorkspaceSnapshot,
    weeklyPlanningSnapshot,
    feedbackNotes,
  };
}
