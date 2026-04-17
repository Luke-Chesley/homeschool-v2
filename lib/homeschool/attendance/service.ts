import "@/lib/server-only";

import { and, asc, desc, eq, gte, lte } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import { homeschoolAttendanceRecords } from "@/lib/db/schema";

import type { HomeschoolAttendanceRecord, HomeschoolAttendanceStatus } from "@/lib/homeschool/attendance/types";

export function getHomeschoolAttendanceDefaults() {
  return {
    status: "present" as const,
    minutes: 240,
  };
}

export async function upsertHomeschoolAttendanceRecord(params: {
  organizationId: string;
  learnerId: string;
  complianceProgramId?: string | null;
  date: string;
  status: HomeschoolAttendanceStatus;
  source?: "manual" | "derived_from_sessions" | "imported";
  minutes?: number | null;
  note?: string | null;
  derivedSessionIds?: string[];
}) {
  const db = getDb();
  const existing = await db.query.homeschoolAttendanceRecords.findFirst({
    where: and(
      eq(homeschoolAttendanceRecords.organizationId, params.organizationId),
      eq(homeschoolAttendanceRecords.learnerId, params.learnerId),
      eq(homeschoolAttendanceRecords.attendanceDate, params.date),
    ),
  });

  if (existing) {
    if (
      existing.status === params.status &&
      (existing.minutes ?? null) === (params.minutes ?? null) &&
      (existing.note ?? null) === (params.note ?? null) &&
      (existing.source ?? "manual") === (params.source ?? "manual") &&
      JSON.stringify(existing.derivedSessionIds ?? []) ===
        JSON.stringify(params.derivedSessionIds ?? [])
    ) {
      return existing;
    }

    const [updated] = await db
      .update(homeschoolAttendanceRecords)
      .set({
        complianceProgramId: params.complianceProgramId ?? existing.complianceProgramId ?? null,
        status: params.status,
        source: params.source ?? "manual",
        minutes: params.minutes ?? null,
        note: params.note ?? null,
        derivedSessionIds: params.derivedSessionIds ?? [],
        updatedAt: new Date(),
      })
      .where(eq(homeschoolAttendanceRecords.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(homeschoolAttendanceRecords)
    .values({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      complianceProgramId: params.complianceProgramId ?? null,
      attendanceDate: params.date,
      status: params.status,
      source: params.source ?? "manual",
      minutes: params.minutes ?? null,
      note: params.note ?? null,
      derivedSessionIds: params.derivedSessionIds ?? [],
      metadata: {},
    })
    .returning();

  return created;
}

export async function listHomeschoolAttendanceRecords(params: {
  organizationId: string;
  learnerId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<HomeschoolAttendanceRecord[]> {
  const db = getDb();
  const rows = await db.query.homeschoolAttendanceRecords.findMany({
    where: and(
      eq(homeschoolAttendanceRecords.organizationId, params.organizationId),
      eq(homeschoolAttendanceRecords.learnerId, params.learnerId),
      params.startDate ? gte(homeschoolAttendanceRecords.attendanceDate, params.startDate) : undefined,
      params.endDate ? lte(homeschoolAttendanceRecords.attendanceDate, params.endDate) : undefined,
    ),
    orderBy: [desc(homeschoolAttendanceRecords.attendanceDate), asc(homeschoolAttendanceRecords.createdAt)],
    limit: params.limit ?? 60,
  });

  return rows.map((row) => ({
    id: row.id,
    date: row.attendanceDate,
    status: row.status,
    minutes: row.minutes ?? null,
    note: row.note ?? null,
    source: row.source,
    derivedSessionIds: Array.isArray(row.derivedSessionIds) ? row.derivedSessionIds : [],
  }));
}

export async function getRecentHomeschoolAttendance(params: {
  organizationId: string;
  learnerId: string;
  days?: number;
}) {
  const duration = params.days ?? 7;
  const endDate = new Date().toISOString().slice(0, 10);
  const start = new Date(`${endDate}T12:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (duration - 1));
  const startDate = start.toISOString().slice(0, 10);

  return listHomeschoolAttendanceRecords({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    startDate,
    endDate,
    limit: duration,
  });
}
