import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { CurriculumAiDraftRequestSchema } from "@/lib/curriculum/ai-draft";
import { buildCurriculumAiDraft } from "@/lib/curriculum/ai-draft-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CurriculumAiDraftRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const session = await requireAppSession();
    const draft = await buildCurriculumAiDraft({
      learner: session.activeLearner,
      answers: parsed.data.answers,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("[api/curriculum/ai-draft POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
