import { NextRequest, NextResponse } from "next/server";
import { startOrResumeAttempt } from "@/lib/activities/session-service";
import { z } from "zod";
import { requireAppSession } from "@/lib/app-session/server";

const CreateAttemptSchema = z.object({
  sessionId: z.string(),
  learnerId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateAttemptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const session = await requireAppSession();
    const attempt = await startOrResumeAttempt(
      parsed.data.sessionId,
      parsed.data.learnerId ?? session.activeLearner.id,
    );
    return NextResponse.json(attempt);
  } catch (err) {
    console.error("[api/activities/attempts POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
