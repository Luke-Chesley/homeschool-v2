import { getPlanningRepository } from "@/lib/planning/mock-repository";

function repo() {
  return getPlanningRepository();
}

export function getWeeklyPlanningView() {
  return repo().getWeeklyPlan();
}

export function getPlanningDayView(date: string) {
  return repo().getPlanningDay(date);
}

export function selectRouteItemForPlanningDay(date: string, weeklyRouteItemId: string) {
  return repo().selectRouteItemForDay(date, weeklyRouteItemId);
}

export function getRecoveryPreview() {
  return repo().getRecoveryPreview();
}

export function getTodayWorkspace(date = "2026-03-31") {
  return repo().getDailyWorkspace(date);
}

export function completeTodayPlanItem(planItemId: string) {
  return repo().markPlanItemComplete(planItemId);
}

export function pushTodayPlanItemToTomorrow(planItemId: string) {
  return repo().pushPlanItemToNextDay(planItemId);
}

export function removeTodayPlanItem(planItemId: string) {
  return repo().removePlanItemFromDay(planItemId);
}

export function swapTodayPlanItemWithAlternate(planItemId: string, alternateWeeklyRouteItemId: string) {
  return repo().swapPlanItemWithAlternate(planItemId, alternateWeeklyRouteItemId);
}

export function formatPlannerDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatMinutes(minutes: number) {
  return `${minutes} min`;
}

export function describeLoad(bufferMinutes: number) {
  if (bufferMinutes >= 45) {
    return "Light day";
  }

  if (bufferMinutes >= 10) {
    return "Balanced day";
  }

  return "Packed day";
}
