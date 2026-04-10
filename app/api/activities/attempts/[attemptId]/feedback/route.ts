import { NextRequest, NextResponse } from "next/server";
import { RequestActivityComponentFeedbackSchema } from "@/lib/activities/feedback";
import { requestActivityComponentFeedback } from "@/lib/activities/session-service";
import { requireAppSession } from "@/lib/app-session/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;

  try {
    const body = await req.json();
    const parsed = RequestActivityComponentFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const session = await requireAppSession();
    const feedback = await requestActivityComponentFeedback(
      attemptId,
      parsed.data,
      session.activeLearner.id,
    );
    return NextResponse.json(feedback);
  } catch (err) {
    console.error("[api/activities/attempts/feedback POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
