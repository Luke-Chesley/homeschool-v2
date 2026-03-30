/**
 * API route: /api/curriculum/sources
 *
 * GET  — list sources for a household
 * POST — create a new source
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listCurriculumSources,
  createCurriculumSource,
} from "@/lib/curriculum/service";
import { CreateCurriculumSourceInputSchema } from "@/lib/curriculum/types";

export async function GET(req: NextRequest) {
  const householdId =
    req.nextUrl.searchParams.get("householdId") ?? "household-demo";
  try {
    const sources = await listCurriculumSources(householdId);
    return NextResponse.json(sources);
  } catch (err) {
    console.error("[api/curriculum/sources GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateCurriculumSourceInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const source = await createCurriculumSource(parsed.data);
    return NextResponse.json(source, { status: 201 });
  } catch (err) {
    console.error("[api/curriculum/sources POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
