import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { getTodayLessonBuildStatus } from "@/lib/planning/today-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAppSession();
    const date = request.nextUrl.searchParams.get("date");
    const sourceId = request.nextUrl.searchParams.get("sourceId");
    const routeFingerprint = request.nextUrl.searchParams.get("routeFingerprint");

    if (!date || !sourceId || !routeFingerprint) {
      return NextResponse.json(
        { ok: false, error: "Missing date, sourceId, or routeFingerprint." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const status = await getTodayLessonBuildStatus({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      date,
      sourceId,
      routeFingerprint,
    });

    return NextResponse.json(
      { ok: true, ...status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[GET /api/today/lesson-build-status]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Status check failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
