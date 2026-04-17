import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { getTodayWorkspaceViewForRender } from "@/lib/planning/today-service";

function buildHeaders(durationMs: number) {
  return {
    "Cache-Control": "no-store",
    "Server-Timing": `today-workspace-patch;dur=${durationMs.toFixed(1)}`,
  };
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();

  try {
    const session = await requireAppSession();
    const date = request.nextUrl.searchParams.get("date");

    if (!date) {
      const durationMs = performance.now() - startedAt;
      return NextResponse.json(
        { ok: false, error: "Missing date." },
        { status: 400, headers: buildHeaders(durationMs) },
      );
    }

    const workspaceResult = await getTodayWorkspaceViewForRender({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date,
    });
    const durationMs = performance.now() - startedAt;

    if (!workspaceResult) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found." },
        { status: 404, headers: buildHeaders(durationMs) },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        workspace: workspaceResult.workspace,
        sourceId: workspaceResult.sourceId,
        routeFingerprint: workspaceResult.routeFingerprint,
      },
      { headers: buildHeaders(durationMs) },
    );
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    console.error("[GET /api/today/workspace-patch]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Workspace refresh failed." },
      { status: 500, headers: buildHeaders(durationMs) },
    );
  }
}
