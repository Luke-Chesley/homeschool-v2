import type {
  StandardsExportRow,
  TrackingDashboard,
  TrackingExportRow,
} from "@/lib/tracking/types";

export function buildTrackingExportRows(dashboard: TrackingDashboard): TrackingExportRow[] {
  return dashboard.outcomes.map((outcome) => ({
    date: outcome.date,
    lesson: outcome.title,
    subject: outcome.subject,
    status: outcome.status,
    plannedMinutes: outcome.plannedMinutes,
    actualMinutes: outcome.actualMinutes,
    mastery: outcome.mastery,
    standards: outcome.standards.join("; "),
    goals: outcome.goals.join("; "),
    deviationNote: outcome.deviationNote ?? "",
  }));
}

export function buildStandardsExportRows(dashboard: TrackingDashboard): StandardsExportRow[] {
  return dashboard.standards.map((row) => ({
    code: row.code,
    status: row.status,
    subject: row.subject,
    evidenceCount: row.evidenceCount,
    latestEvidence: row.latestEvidence,
  }));
}
