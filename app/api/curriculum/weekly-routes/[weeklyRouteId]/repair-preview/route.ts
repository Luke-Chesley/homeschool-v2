import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { previewWeeklyRouteRepair } from "@/lib/curriculum-routing";

interface RouteProps {
  params: Promise<{ weeklyRouteId: string }>;
}

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAppSession();
    const { weeklyRouteId } = await params;
    const preview = await previewWeeklyRouteRepair({
      learnerId: session.activeLearner.id,
      weeklyRouteId,
    });
    return NextResponse.json(preview);
  } catch (error) {
    console.error("[api/curriculum/weekly-routes/[weeklyRouteId]/repair-preview POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
