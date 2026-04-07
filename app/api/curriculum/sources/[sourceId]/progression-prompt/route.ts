import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { buildProgressionPromptPreview } from "@/lib/curriculum/progression-regeneration";
import { CURRICULUM_PROGRESSION_PROMPT_VERSION } from "@/lib/prompts/curriculum-draft";

interface RouteContext {
  params: Promise<{ sourceId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAppSession();
    const { sourceId } = await params;

    const preview = await buildProgressionPromptPreview({
      sourceId,
      householdId: session.organization.id,
      learnerDisplayName: session.activeLearner?.displayName ?? "Learner",
    });

    return NextResponse.json({
      promptVersion: CURRICULUM_PROGRESSION_PROMPT_VERSION,
      debug: preview,
    });
  } catch (error) {
    console.error("[api/curriculum/sources/[sourceId]/progression-prompt GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
