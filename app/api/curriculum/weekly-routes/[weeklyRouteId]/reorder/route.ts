import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { reorderWeeklyRouteItem } from "@/lib/curriculum-routing";

const ReorderWeeklyRouteItemSchema = z.object({
  weeklyRouteItemId: z.string().min(1),
  targetPosition: z.number().int().nonnegative(),
  manualOverrideNote: z.string().max(500).optional(),
});

interface RouteProps {
  params: Promise<{ weeklyRouteId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    const session = await requireAppSession();
    const { weeklyRouteId } = await params;
    const body = await req.json();
    const parsed = ReorderWeeklyRouteItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const board = await reorderWeeklyRouteItem({
      learnerId: session.activeLearner.id,
      weeklyRouteId,
      weeklyRouteItemId: parsed.data.weeklyRouteItemId,
      targetPosition: parsed.data.targetPosition,
      manualOverrideNote: parsed.data.manualOverrideNote,
    });

    return NextResponse.json(board);
  } catch (error) {
    console.error("[api/curriculum/weekly-routes/[weeklyRouteId]/reorder POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
