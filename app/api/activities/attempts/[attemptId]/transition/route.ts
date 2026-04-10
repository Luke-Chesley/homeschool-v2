import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { requestActivityComponentTransition } from "@/lib/activities/session-service";
import { RequestActivityComponentTransitionSchema } from "@/lib/activities/widget-transition";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;

  try {
    const body = await req.json();
    const parsed = RequestActivityComponentTransitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const session = await requireAppSession();
    const transition = await requestActivityComponentTransition(
      attemptId,
      parsed.data,
      session.activeLearner.id,
    );
    return NextResponse.json(transition);
  } catch (err) {
    console.error("[api/activities/attempts/transition POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
