import { NextRequest, NextResponse } from "next/server";

import { isAppApiSessionError } from "@/lib/app-session/server";

import { dispatchCopilotAction, loadAuthorizedCopilotAction } from "../_shared";

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
      return NextResponse.json({ ok: true, action: loaded.action });
    }

    if (loaded.action.status === "applying") {
      return NextResponse.json({ error: "This action is already applying." }, { status: 409 });
    }

    if (loaded.action.status === "dismissed") {
      return NextResponse.json({ error: "Dismissed actions cannot be applied." }, { status: 409 });
    }

    await loaded.store.updateActionStatus(
      loaded.request.sessionId,
      loaded.request.actionId,
      { status: "applying", error: null, result: null },
      {
        householdId: loaded.session.organization.id,
        learnerId: loaded.session.activeLearner.id,
      },
    );

    try {
      const result = await dispatchCopilotAction(loaded.session, loaded.action);
      const updatedAction = await loaded.store.updateActionStatus(
        loaded.request.sessionId,
        loaded.request.actionId,
        { status: "applied", result, error: null },
        {
          householdId: loaded.session.organization.id,
          learnerId: loaded.session.activeLearner.id,
        },
      );

      return NextResponse.json({ ok: true, action: updatedAction });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not apply the Copilot action.";
      const failedAction = await loaded.store.updateActionStatus(
        loaded.request.sessionId,
        loaded.request.actionId,
        { status: "failed", error: message, result: null },
        {
          householdId: loaded.session.organization.id,
          learnerId: loaded.session.activeLearner.id,
        },
      );

      return NextResponse.json(
        { error: message, action: failedAction },
        { status: 500 },
      );
    }
  } catch (error) {
    if (isAppApiSessionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    console.error("[POST /api/copilot/actions/apply]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
