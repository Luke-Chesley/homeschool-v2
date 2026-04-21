import { NextRequest, NextResponse } from "next/server";

import { isAppApiSessionError } from "@/lib/app-session/server";

import { loadAuthorizedCopilotAction } from "../_shared";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const loaded = await loadAuthorizedCopilotAction(body);
    if (!loaded.ok) {
      return NextResponse.json(
        { error: loaded.error, issues: "issues" in loaded ? loaded.issues : undefined },
        { status: loaded.status },
      );
    }

    if (loaded.action.status === "applied") {
      return NextResponse.json({ error: "Applied actions cannot be dismissed." }, { status: 409 });
    }

    const action = await loaded.store.updateActionStatus(
      loaded.request.sessionId,
      loaded.request.actionId,
      { status: "dismissed", error: null, result: null },
      {
        householdId: loaded.session.organization.id,
        learnerId: loaded.session.activeLearner.id,
      },
    );

    return NextResponse.json({ ok: true, action });
  } catch (error) {
    if (isAppApiSessionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    console.error("[POST /api/copilot/actions/dismiss]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
