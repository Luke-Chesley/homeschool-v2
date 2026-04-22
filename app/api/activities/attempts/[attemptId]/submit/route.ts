import { NextRequest, NextResponse } from "next/server";
import { submitAttempt } from "@/lib/activities/session-service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  try {
    const result = await submitAttempt(attemptId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/activities/attempts/submit POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
