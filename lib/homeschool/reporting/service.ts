import "@/lib/server-only";

import { and, desc, eq, gte } from "drizzle-orm";

import { homeschoolTemplate } from "@/config/templates/homeschool";
import { getDb } from "@/lib/db/server";
import {
  homeschoolAuditEvents,
  homeschoolAttendanceRecords,
  learnerProfiles,
  lessonSessions,
  planItems,
} from "@/lib/db/schema";
import type { TrackingDashboard } from "@/lib/tracking/types";

import type {
  HomeschoolMonthlySummary,
  HomeschoolTranscriptSkeleton,
  HomeschoolWeeklySummary,
} from "@/lib/homeschool/reporting/types";

export function getHomeschoolReportingConfig() {
  return homeschoolTemplate.reporting;
}

function startOfWindow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return date.toISOString().slice(0, 10);
}

export async function recordHomeschoolAuditEvent(params: {
  organizationId: string;
  learnerId?: string | null;
  entityType: "onboarding" | "curriculum" | "weekly_plan" | "today_workspace" | "attendance" | "report" | "preference";
  entityId?: string | null;
  eventType: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await getDb().insert(homeschoolAuditEvents).values({
    organizationId: params.organizationId,
    learnerId: params.learnerId ?? null,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    eventType: params.eventType,
    summary: params.summary,
    metadata: params.metadata ?? {},
  });
}

export async function buildHomeschoolWeeklySummary(params: {
  organizationId: string;
  learnerId: string;
  dashboard: TrackingDashboard;
}): Promise<HomeschoolWeeklySummary> {
  const startDate = startOfWindow(7);
  const attendance = await getDb().query.homeschoolAttendanceRecords.findMany({
    where: and(
      eq(homeschoolAttendanceRecords.organizationId, params.organizationId),
      eq(homeschoolAttendanceRecords.learnerId, params.learnerId),
      gte(homeschoolAttendanceRecords.attendanceDate, startDate),
    ),
  });

  const completedCount = params.dashboard.outcomes.filter((outcome) => outcome.status === "completed").length;
  const partialCount = params.dashboard.outcomes.filter((outcome) => outcome.status === "partial").length;
  const skippedCount = params.dashboard.outcomes.filter((outcome) => outcome.status === "skipped").length;

  return {
    completedCount,
    partialCount,
    skippedCount,
    attendanceCount: attendance.filter((row) => row.status === "present" || row.status === "partial" || row.status === "field_trip").length,
    narrative:
      completedCount > skippedCount
        ? "The week stayed workable overall, with more completed work than missed work."
        : "The week needed recovery time. Use next week’s plan to lighten the first day and carry essential work forward.",
  };
}

export async function buildHomeschoolMonthlySummary(params: {
  organizationId: string;
  learnerId: string;
  dashboard: TrackingDashboard;
}): Promise<HomeschoolMonthlySummary> {
  const startDate = startOfWindow(30);
  const attendance = await getDb().query.homeschoolAttendanceRecords.findMany({
    where: and(
      eq(homeschoolAttendanceRecords.organizationId, params.organizationId),
      eq(homeschoolAttendanceRecords.learnerId, params.learnerId),
      gte(homeschoolAttendanceRecords.attendanceDate, startDate),
    ),
  });

  const totalAttendanceDays = attendance.length;
  const attendedDays = attendance.filter((row) => row.status !== "absent").length;
  const subjectBreakdownMap = new Map<string, number>();

  for (const outcome of params.dashboard.outcomes) {
    subjectBreakdownMap.set(outcome.subject, (subjectBreakdownMap.get(outcome.subject) ?? 0) + 1);
  }

  return {
    attendanceRate: totalAttendanceDays === 0 ? 0 : Math.round((attendedDays / totalAttendanceDays) * 100),
    totalLessonCount: params.dashboard.outcomes.length,
    completedLessonCount: params.dashboard.outcomes.filter((outcome) => outcome.status === "completed").length,
    subjectBreakdown: [...subjectBreakdownMap.entries()].map(([subject, count]) => ({
      subject,
      count,
    })),
  };
}

export async function buildHomeschoolTranscriptSkeleton(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  dashboard: TrackingDashboard;
}): Promise<HomeschoolTranscriptSkeleton> {
  const db = getDb();
  const profile = await db.query.learnerProfiles.findFirst({
    where: eq(learnerProfiles.learnerId, params.learnerId),
  });

  const lessonRows = await db
    .select({
      subject: planItems.subject,
      title: planItems.title,
      completionStatus: lessonSessions.completionStatus,
    })
    .from(lessonSessions)
    .leftJoin(planItems, eq(planItems.id, lessonSessions.planItemId))
    .where(eq(lessonSessions.learnerId, params.learnerId))
    .orderBy(desc(lessonSessions.createdAt));

  const grouped = new Map<string, { courseTitle: string; status: string; evidenceCount: number }>();
  for (const row of lessonRows) {
    const subject = row.subject ?? "General";
    const existing = grouped.get(subject);
    if (existing) {
      existing.evidenceCount += 1;
      if (row.completionStatus === "completed_as_planned") {
        existing.status = "completed";
      }
      continue;
    }

    grouped.set(subject, {
      courseTitle: `${subject} Studies`,
      status: row.completionStatus === "completed_as_planned" ? "completed" : "in_progress",
      evidenceCount: 1,
    });
  }

  return {
    learnerName: params.learnerName,
    gradeLabel: profile?.gradeLevel ?? "Unspecified grade",
    entries: [...grouped.entries()].map(([subject, entry]) => ({
      subject,
      courseTitle: entry.courseTitle,
      status: entry.status,
      evidenceCount: entry.evidenceCount,
    })),
  };
}
