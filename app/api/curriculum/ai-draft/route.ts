import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import {
  CurriculumAiCreateRequestSchema,
  CurriculumAiCreateResultSchema,
} from "@/lib/curriculum/ai-draft";
import { createCurriculumFromConversation } from "@/lib/curriculum/ai-draft-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CurriculumAiCreateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const session = await requireAppSession();
    const created = await createCurriculumFromConversation({
      householdId: session.organization.id,
      learner: session.activeLearner,
      messages: parsed.data.messages,
    });

    const payload = CurriculumAiCreateResultSchema.parse(created);
    return NextResponse.json(payload, {
      status: payload.kind === "failure" ? 422 : 200,
    });
  } catch (error) {
    console.error("[api/curriculum/ai-draft POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
