"use client";

import type { TodayWorkspacePatch } from "@/app/(parent)/today/actions";

export async function fetchTodayWorkspacePatch(date: string): Promise<TodayWorkspacePatch | null> {
  const response = await fetch(`/api/today/workspace-patch?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as
    | ({ ok: true } & TodayWorkspacePatch)
    | { ok: false; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Workspace refresh failed." : payload.error ?? "Workspace refresh failed.");
  }

  return {
    workspace: payload.workspace,
    sourceId: payload.sourceId,
    routeFingerprint: payload.routeFingerprint,
  };
}
