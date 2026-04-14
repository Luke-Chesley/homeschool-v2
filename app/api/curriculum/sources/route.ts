/**
 * API route: /api/curriculum/sources
 *
 * GET  — list sources for a household
 * POST — create a new source
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import {
  createCurriculumSource,
  importCurriculumSourceFromLocalJson,
  listCurriculumSources,
} from "@/lib/curriculum/service";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackProductEvent } from "@/lib/platform/observability";
import { CreateCurriculumSourceInputSchema } from "@/lib/curriculum/types";

const ImportLocalCurriculumRequestSchema = z.object({
  importPreset: z.literal("local_curriculum_json"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAppSession();
    const requestedHouseholdId = req.nextUrl.searchParams.get("householdId");
    if (requestedHouseholdId && requestedHouseholdId !== session.organization.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const sources = await listCurriculumSources(session.organization.id);
    return NextResponse.json(sources);
  } catch (err) {
    console.error("[api/curriculum/sources GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAppSession();
    const body = await req.json();
    const parsed = z
      .union([CreateCurriculumSourceInputSchema, ImportLocalCurriculumRequestSchema])
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const source =
      "importPreset" in parsed.data
        ? await importCurriculumSourceFromLocalJson(session.organization.id)
        : await createCurriculumSource({
            ...parsed.data,
            householdId: session.organization.id,
          });

    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.curriculumSourceAdded,
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      metadata: {
        sourceId: source.id,
        kind: source.kind,
        intakeMode: "importPreset" in parsed.data ? parsed.data.importPreset : parsed.data.kind,
      },
    });

    return NextResponse.json(source, { status: 201 });
  } catch (err) {
    console.error("[api/curriculum/sources POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
