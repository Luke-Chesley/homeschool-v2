import { getTrackingRepository } from "@/lib/tracking/mock-repository";
import { buildStandardsExportRows, buildTrackingExportRows } from "@/lib/tracking/export";

function repo() {
  return getTrackingRepository();
}

export function getTrackingDashboard() {
  return repo().getDashboard();
}

export function getTrackingExportPreview() {
  const dashboard = getTrackingDashboard();

  return {
    lessonRows: buildTrackingExportRows(dashboard),
    standardRows: buildStandardsExportRows(dashboard),
  };
}

export function formatTrackingDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatMinutes(minutes: number) {
  return `${minutes} min`;
}

export function formatOutcomeDelta(plannedMinutes: number, actualMinutes: number) {
  const delta = actualMinutes - plannedMinutes;

  if (delta === 0) {
    return "On plan";
  }

  if (delta > 0) {
    return `+${delta} min over`;
  }

  return `${Math.abs(delta)} min under`;
}
