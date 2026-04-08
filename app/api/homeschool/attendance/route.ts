import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { upsertHomeschoolAttendanceRecord } from "@/lib/homeschool/attendance/service";
import { recordHomeschoolAuditEvent } from "@/lib/homeschool/reporting/service";
import { trackOperationalError, trackProductEvent } from "@/lib/platform/observability";

const AttendanceSchema = z.object({
  date: z.string().min(1),
  status: z.enum(["present", "partial", "absent", "field_trip", "holiday"]),
  minutes: z.number().int().min(0).max(480).optional(),
  note: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = AttendanceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid attendance input." }, { status: 400 });
  }

  try {
    const session = await requireAppSession();
    const record = await upsertHomeschoolAttendanceRecord({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      date: parsed.data.date,
      status: parsed.data.status,
      minutes: parsed.data.minutes ?? null,
      note: parsed.data.note ?? null,
    });

    await recordHomeschoolAuditEvent({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      entityType: "attendance",
      entityId: record.id,
      eventType: "attendance.updated",
      summary: `Marked ${session.activeLearner.displayName} as ${parsed.data.status} on ${parsed.data.date}.`,
      metadata: parsed.data,
    });
    trackProductEvent({
      name: "homeschool_attendance_updated",
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      metadata: parsed.data,
    });

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    console.error("[api/homeschool/attendance POST]", error);
    trackOperationalError({
      source: "api/homeschool/attendance",
      message: error instanceof Error ? error.message : "Could not save attendance.",
    });
    return NextResponse.json({ error: "Could not save attendance." }, { status: 500 });
  }
}
