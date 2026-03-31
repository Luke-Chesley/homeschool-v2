import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { getOrCreateWeeklyRouteBoardForLearner } from "@/lib/planning/weekly-route-service";

const WeeklyRouteQuerySchema = z.object({
  sourceId: z.string().min(1),
  weekStartDate: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAppSession();
    const parsed = WeeklyRouteQuerySchema.safeParse({
      sourceId: req.nextUrl.searchParams.get("sourceId"),
      weekStartDate: req.nextUrl.searchParams.get("weekStartDate") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await getOrCreateWeeklyRouteBoardForLearner({
      learnerId: session.activeLearner.id,
      sourceId: parsed.data.sourceId,
      weekStartDate: parsed.data.weekStartDate,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/planning/weekly-route GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
