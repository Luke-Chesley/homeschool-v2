import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { getTodayBuildStatus } from "@/lib/planning/today-service";

function buildHeaders(durationMs: number) {
  return {
    "Cache-Control": "no-store",
    "Server-Timing": `today-lesson-build-status;dur=${durationMs.toFixed(1)}`,
  };
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();

  try {
    const session = await requireAppSession();
    const date = request.nextUrl.searchParams.get("date");
    const sourceId = request.nextUrl.searchParams.get("sourceId");
    const routeFingerprint = request.nextUrl.searchParams.get("routeFingerprint");

    if (!date || !sourceId || !routeFingerprint) {
      const durationMs = performance.now() - startedAt;
      return NextResponse.json(
        { ok: false, error: "Missing date, sourceId, or routeFingerprint." },
        { status: 400, headers: buildHeaders(durationMs) },
      );
    }

    const status = await getTodayBuildStatus({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      date,
      sourceId,
      routeFingerprint,
    });
    const durationMs = performance.now() - startedAt;

    return NextResponse.json(
      {
        ok: true,
        build: status.lessonBuild,
        draft: status.lessonDraft,
        activityBuild: status.activityBuild,
      },
      { headers: buildHeaders(durationMs) },
    );
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    console.error("[GET /api/today/lesson-build-status]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Status check failed." },
      { status: 500, headers: buildHeaders(durationMs) },
    );
  }
}
