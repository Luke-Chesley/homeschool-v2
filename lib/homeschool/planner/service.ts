import "@/lib/server-only";

import { homeschoolTemplate } from "@/config/templates/homeschool";
import type { WeeklyRouteBoard } from "@/lib/curriculum-routing";

export function getHomeschoolPlannerPolicy() {
  return homeschoolTemplate.plannerPolicy;
}

export function buildHomeschoolPlannerSummary(board: WeeklyRouteBoard) {
  const scheduledCount = board.items.filter((item) => item.scheduledDate).length;
  const doneCount = board.items.filter((item) => item.state === "done").length;
  const unscheduledCount = board.items.filter((item) => !item.scheduledDate).length;
  const scheduledByDate = new Map<string, number>();
  for (const item of board.items) {
    if (!item.scheduledDate) {
      continue;
    }
    scheduledByDate.set(item.scheduledDate, (scheduledByDate.get(item.scheduledDate) ?? 0) + 1);
  }
  const overloadedDays = [...scheduledByDate.entries()].filter(
    ([, count]) => count > homeschoolTemplate.plannerPolicy.maxItemsPerDay,
  );

  return {
    scheduledCount,
    doneCount,
    unscheduledCount,
    overloadedDayCount: overloadedDays.length,
    guidance:
      overloadedDays.length > 0
        ? "At least one day is heavier than the homeschool planner policy recommends. Move or lighten work before the week starts."
        : unscheduledCount > 0
          ? "Some work is still unscheduled. Place the essentials first and leave flex space for recovery."
          : "The week is balanced enough to run as planned, with room to adapt if a day slips.",
  };
}
