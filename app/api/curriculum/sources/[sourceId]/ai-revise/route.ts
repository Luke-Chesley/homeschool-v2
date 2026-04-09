import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import {
  CurriculumAiRevisionRequestSchema,
  CurriculumAiRevisionResultSchema,
} from "@/lib/curriculum/ai-draft";
import {
  buildCurriculumRevisionPromptPreview,
  reviseCurriculumFromConversation,
} from "@/lib/curriculum/ai-draft-service";

interface RouteContext {
  params: Promise<{
    sourceId: string;
  }>;
}

const CurriculumAiRevisionDebugRequestSchema = CurriculumAiRevisionRequestSchema.extend({
  debug: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const body = await req.json();
    const parsed = CurriculumAiRevisionDebugRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const session = await requireAppSession();
    const { sourceId } = await params;

    if (parsed.data.debug) {
      const promptPreview = await buildCurriculumRevisionPromptPreview({
        householdId: session.organization.id,
        sourceId,
        learner: session.activeLearner,
        messages: parsed.data.messages,
      });

      return NextResponse.json({
        debug: promptPreview,
      });
    }

    const revised = await reviseCurriculumFromConversation({
      householdId: session.organization.id,
      sourceId,
      learner: session.activeLearner,
      messages: parsed.data.messages,
    });

    const payload = CurriculumAiRevisionResultSchema.parse(revised);
    return NextResponse.json(payload, {
      status: payload.kind === "failure" ? 422 : 200,
    });
  } catch (error) {
    console.error("[api/curriculum/sources/[sourceId]/ai-revise POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
