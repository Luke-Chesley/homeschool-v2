import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { refreshMonthlyRouteSchedules } from "@/lib/planning/weekly-route-service";

const RefreshMonthlyScheduleSchema = z.object({
  sourceId: z.string().min(1),
  monthDate: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAppSession();
    const rawBody = await req.text();
    if (!rawBody.trim()) {
      return NextResponse.json({ error: "Request body is required" }, { status: 400 });
    }

    const body = JSON.parse(rawBody);
    const parsed = RefreshMonthlyScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await refreshMonthlyRouteSchedules({
      learnerId: session.activeLearner.id,
      sourceId: parsed.data.sourceId,
      monthDate: parsed.data.monthDate,
      createdByAdultUserId: session.adultUser.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/planning/month-schedule-refresh POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
