import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { refreshWeeklyRouteSchedule } from "@/lib/planning/weekly-route-service";

interface RouteProps {
  params: Promise<{ weeklyRouteId: string }>;
}

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAppSession();
    const { weeklyRouteId } = await params;
    const board = await refreshWeeklyRouteSchedule({
      learnerId: session.activeLearner.id,
      weeklyRouteId,
      createdByAdultUserId: session.adultUser.id,
    });

    return NextResponse.json(board);
  } catch (error) {
    console.error("[api/planning/weekly-routes/[weeklyRouteId]/refresh-schedule POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
