import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { applyWeeklyRouteRepair } from "@/lib/curriculum-routing";

interface RouteProps {
  params: Promise<{ weeklyRouteId: string }>;
}

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAppSession();
    const { weeklyRouteId } = await params;
    const board = await applyWeeklyRouteRepair({
      learnerId: session.activeLearner.id,
      weeklyRouteId,
    });
    return NextResponse.json(board);
  } catch (error) {
    console.error("[api/curriculum/weekly-routes/[weeklyRouteId]/repair-apply POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
