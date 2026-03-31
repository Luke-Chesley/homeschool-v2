import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { moveWeeklyRouteItem } from "@/lib/planning/weekly-route-service";

const UpdateWeeklyRouteItemSchema = z.object({
  weeklyRouteId: z.string().min(1),
  targetScheduledDate: z.string().nullable(),
  targetIndex: z.number().int().nonnegative(),
  manualOverrideNote: z.string().max(500).optional(),
});

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
  try {
    const session = await requireAppSession();
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateWeeklyRouteItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const board = await moveWeeklyRouteItem({
      learnerId: session.activeLearner.id,
      weeklyRouteId: parsed.data.weeklyRouteId,
      weeklyRouteItemId: id,
      targetScheduledDate: parsed.data.targetScheduledDate,
      targetIndex: parsed.data.targetIndex,
      manualOverrideNote: parsed.data.manualOverrideNote,
    });

    return NextResponse.json(board);
  } catch (error) {
    console.error("[api/planning/weekly-route-items/[id] PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
