import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/activities/session-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    console.error("[api/activities/sessions GET] Session not found for id:", sessionId);
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}
