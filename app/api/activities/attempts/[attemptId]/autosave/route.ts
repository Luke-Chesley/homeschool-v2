import { NextRequest, NextResponse } from "next/server";
import { autosave } from "@/lib/activities/session-service";
import { z } from "zod";

const AutosaveSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    value: z.unknown(),
    correct: z.boolean().optional(),
    timeMs: z.number().optional(),
  })),
  uiState: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  try {
    const body = await req.json();
    const parsed = AutosaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const updated = await autosave(attemptId, parsed.data.answers, parsed.data.uiState);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[api/activities/attempts/autosave PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
