import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { getCurriculumSource } from "@/lib/curriculum/service";
import { generateWeeklyRoute, getWeeklyRouteBoard, toWeekStartDate } from "@/lib/curriculum-routing";

const WeeklyRouteQuerySchema = z.object({
  sourceId: z.string().min(1),
  weekStartDate: z.string().optional(),
});

const GenerateWeeklyRouteSchema = z.object({
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

    const weekStartDate = toWeekStartDate(parsed.data.weekStartDate);
    const source = await getCurriculumSource(parsed.data.sourceId, session.organization.id);
    if (!source) {
      return NextResponse.json({ error: "Curriculum source not found." }, { status: 404 });
    }

    const board = await getWeeklyRouteBoard({
      learnerId: session.activeLearner.id,
      sourceId: parsed.data.sourceId,
      weekStartDate,
    });

    if (!board) {
      return NextResponse.json({ error: "Weekly route not found." }, { status: 404 });
    }

    return NextResponse.json(board);
  } catch (error) {
    console.error("[api/curriculum/weekly-routes GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAppSession();
    const body = await req.json();
    const parsed = GenerateWeeklyRouteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const source = await getCurriculumSource(parsed.data.sourceId, session.organization.id);
    if (!source) {
      return NextResponse.json({ error: "Curriculum source not found." }, { status: 404 });
    }

    const board = await generateWeeklyRoute({
      learnerId: session.activeLearner.id,
      sourceId: parsed.data.sourceId,
      weekStartDate: parsed.data.weekStartDate,
    });

    return NextResponse.json(board, { status: 201 });
  } catch (error) {
    console.error("[api/curriculum/weekly-routes POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
