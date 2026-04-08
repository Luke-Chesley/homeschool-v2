import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { listHomeschoolAttendanceRecords } from "@/lib/homeschool/attendance/service";
import {
  buildHomeschoolTranscriptSkeleton,
  recordHomeschoolAuditEvent,
} from "@/lib/homeschool/reporting/service";
import { trackProductEvent } from "@/lib/platform/observability";
import { buildTrackingExportRows, getTrackingDashboard } from "@/lib/tracking";

function toCsvRow(values: Array<string | number>) {
  return values
    .map((value) => `"${String(value).replaceAll('"', '""')}"`)
    .join(",");
}

export async function GET(req: NextRequest) {
  const session = await requireAppSession();
  const kind = req.nextUrl.searchParams.get("kind") ?? "progress_report";
  const dashboard = await getTrackingDashboard({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
  });

  let filename = "progress-report.csv";
  let csv = "";

  if (kind === "attendance_log") {
    filename = "attendance-log.csv";
    const rows = await listHomeschoolAttendanceRecords({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      limit: 180,
    });
    csv = [
      toCsvRow(["date", "status", "minutes", "note"]),
      ...rows.map((row) => toCsvRow([row.date, row.status, row.minutes ?? "", row.note ?? ""])),
    ].join("\n");
  } else if (kind === "transcript_skeleton") {
    filename = "transcript-skeleton.csv";
    const transcript = await buildHomeschoolTranscriptSkeleton({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      dashboard,
    });
    csv = [
      toCsvRow(["learner", "grade", "subject", "course_title", "status", "evidence_count"]),
      ...transcript.entries.map((entry) =>
        toCsvRow([
          transcript.learnerName,
          transcript.gradeLabel,
          entry.subject,
          entry.courseTitle,
          entry.status,
          entry.evidenceCount,
        ]),
      ),
    ].join("\n");
  } else {
    const rows = buildTrackingExportRows(dashboard);
    csv = [
      toCsvRow([
        "date",
        "lesson",
        "subject",
        "status",
        "planned_minutes",
        "actual_minutes",
        "mastery",
        "standards",
        "goals",
        "deviation_note",
      ]),
      ...rows.map((row) =>
        toCsvRow([
          row.date,
          row.lesson,
          row.subject,
          row.status,
          row.plannedMinutes,
          row.actualMinutes,
          row.mastery,
          row.standards,
          row.goals,
          row.deviationNote,
        ]),
      ),
    ].join("\n");
  }

  await recordHomeschoolAuditEvent({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    entityType: "report",
    eventType: "report.exported",
    summary: `Exported ${kind}.`,
    metadata: { kind },
  });
  trackProductEvent({
    name: "homeschool_report_exported",
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    metadata: { kind },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
