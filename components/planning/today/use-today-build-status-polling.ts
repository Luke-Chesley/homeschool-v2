"use client";

import { useEffect, useRef } from "react";

import type {
  DailyWorkspaceActivityBuild,
  DailyWorkspaceActivityState,
  DailyWorkspaceLessonBuild,
  DailyWorkspaceLessonDraft,
} from "@/lib/planning/types";

const POLL_DELAYS_MS = [1000, 2000, 4000] as const;

function isBuildActive(build?: DailyWorkspaceLessonBuild | DailyWorkspaceActivityBuild | null) {
  return build?.status === "queued" || build?.status === "generating";
}

export function useTodayBuildStatusPolling(params: {
  date: string;
  sourceId?: string;
  routeFingerprint: string;
  lessonSessionId?: string | null;
  lessonBuild?: DailyWorkspaceLessonBuild | null;
  activityBuild?: DailyWorkspaceActivityBuild | null;
  onStatus: (patch: {
    lessonBuild?: DailyWorkspaceLessonBuild | null;
    lessonDraft?: DailyWorkspaceLessonDraft | null;
    activityBuild?: DailyWorkspaceActivityBuild | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) => void;
}) {
  const onStatusRef = useRef(params.onStatus);

  useEffect(() => {
    onStatusRef.current = params.onStatus;
  }, [params.onStatus]);

  useEffect(() => {
    if (!params.sourceId) {
      return;
    }

    if (!isBuildActive(params.lessonBuild) && !isBuildActive(params.activityBuild)) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    let attempt = 1;
    const activeSourceId = params.sourceId;
    const activeRouteFingerprint = params.routeFingerprint;
    const activeLessonSessionId = params.lessonSessionId;

    async function pollStatus() {
      try {
        const searchParams = new URLSearchParams({
          date: params.date,
          sourceId: activeSourceId,
          routeFingerprint: activeRouteFingerprint,
        });
        if (activeLessonSessionId) {
          searchParams.set("lessonSessionId", activeLessonSessionId);
        }

        const response = await fetch(`/api/today/build-status?${searchParams.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | {
              ok: true;
              lessonBuild?: DailyWorkspaceLessonBuild | null;
              lessonDraft?: DailyWorkspaceLessonDraft | null;
              activityBuild?: DailyWorkspaceActivityBuild | null;
              activityState?: DailyWorkspaceActivityState | null;
            }
          | { ok: false; error?: string };

        if (cancelled || !response.ok || !payload.ok) {
          return;
        }

        onStatusRef.current({
          lessonBuild: payload.lessonBuild ?? null,
          lessonDraft: payload.lessonDraft ?? null,
          activityBuild: payload.activityBuild ?? null,
          activityState: payload.activityState ?? null,
        });

        if (!isBuildActive(payload.lessonBuild) && !isBuildActive(payload.activityBuild)) {
          return;
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[useTodayBuildStatusPolling]", error);
        }
      }

      if (!cancelled) {
        const delayMs = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)];
        attempt += 1;
        timeoutId = window.setTimeout(pollStatus, delayMs);
      }
    }

    timeoutId = window.setTimeout(pollStatus, POLL_DELAYS_MS[0]);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    params.activityBuild?.status,
    params.activityBuild?.updatedAt,
    params.date,
    params.lessonBuild?.status,
    params.lessonBuild?.updatedAt,
    params.lessonSessionId,
    params.routeFingerprint,
    params.sourceId,
  ]);
}
