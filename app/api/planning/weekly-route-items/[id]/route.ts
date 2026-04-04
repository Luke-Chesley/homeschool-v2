import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import {
  duplicateWeeklyRouteItem,
  moveWeeklyRouteItem,
  updateWeeklyRouteItemState,
} from "@/lib/planning/weekly-route-service";
import { WeeklyRouteItemStateSchema } from "@/lib/curriculum-routing/types";

const UpdateWeeklyRouteItemSchema = z.object({
  weeklyRouteId: z.string().min(1),
  targetWeeklyRouteId: z.string().min(1).optional(),
  targetScheduledDate: z.string().nullable().optional(),
  targetIndex: z.number().int().nonnegative().optional(),
  state: WeeklyRouteItemStateSchema.optional(),
  manualOverrideNote: z.string().max(500).optional(),
  duplicateTargetDate: z.string().nullable().optional(),
});

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
  try {
    const session = await requireAppSession();
    const { id } = await params;
    const rawBody = await req.text();
    if (!rawBody.trim()) {
      return NextResponse.json({ error: "Request body is required" }, { status: 400 });
    }

    const body = JSON.parse(rawBody);
    const parsed = UpdateWeeklyRouteItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const board =
      parsed.data.duplicateTargetDate !== undefined
        ? await duplicateWeeklyRouteItem({
            learnerId: session.activeLearner.id,
            weeklyRouteId: parsed.data.weeklyRouteId,
            weeklyRouteItemId: id,
            targetScheduledDate: parsed.data.duplicateTargetDate,
            manualOverrideNote: parsed.data.manualOverrideNote,
          })
        : parsed.data.state && parsed.data.targetIndex == null
        ? await updateWeeklyRouteItemState({
            learnerId: session.activeLearner.id,
            weeklyRouteId: parsed.data.weeklyRouteId,
            weeklyRouteItemId: id,
            state: parsed.data.state,
            manualOverrideNote: parsed.data.manualOverrideNote,
          })
        : parsed.data.targetIndex != null
          ? await moveWeeklyRouteItem({
              learnerId: session.activeLearner.id,
              weeklyRouteId: parsed.data.weeklyRouteId,
              weeklyRouteItemId: id,
              targetWeeklyRouteId: parsed.data.targetWeeklyRouteId,
              targetScheduledDate: parsed.data.targetScheduledDate ?? null,
              targetIndex: parsed.data.targetIndex,
              manualOverrideNote: parsed.data.manualOverrideNote,
            })
          : null;

    if (!board) {
      return NextResponse.json(
        { error: "Provide either state or a target index for reordering." },
        { status: 400 },
      );
    }

    return NextResponse.json(board);
  } catch (error) {
    console.error("[api/planning/weekly-route-items/[id] PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
