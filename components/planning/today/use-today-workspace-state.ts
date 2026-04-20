"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  TodayPlanItemActionResult,
  TodayPlanItemEvaluationResult,
  TodayWorkspacePatch,
} from "@/app/(parent)/today/actions";
import type {
  DailyWorkspace,
  DailyWorkspaceActivityState,
  DailyWorkspaceLessonBuild,
  DailyWorkspaceLessonDraft,
} from "@/lib/planning/types";
import {
  applyTodayPlanItemActionPatch,
  applyTodayPlanItemEvaluationPatch,
  buildTodaySlotWorkspace,
  buildTodayWorkspaceSlotState,
  buildTodayWorkspaceSlotSummaries,
  getTodayWorkspaceSlot,
  resolveTodayWorkspaceSlotId,
  resolveTodayWorkspaceSlotRouteFingerprint,
  type TodayWorkspaceSlotState,
} from "@/lib/planning/today-workspace-patches";

import { canRepeatToTomorrow, initialDraftState } from "./types";
import { useTodayBuildStatusPolling } from "./use-today-build-status-polling";
import { fetchTodayWorkspacePatch } from "./workspace-state-patches";

function buildInitialSlotState(workspace: DailyWorkspace) {
  const slotId = resolveTodayWorkspaceSlotId(
    workspace,
    workspace.leadItem.planDaySlotId ?? workspace.leadItem.id,
  );
  if (!slotId) {
    return {};
  }

  return {
    [slotId]: buildTodayWorkspaceSlotState(workspace, slotId),
  } satisfies Record<string, TodayWorkspaceSlotState>;
}

export function useTodayWorkspaceState(params: {
  workspace: DailyWorkspace;
  sourceId?: string;
}) {
  const [workspaceState, setWorkspaceState] = useState(params.workspace);
  const [sourceIdState, setSourceIdState] = useState(params.sourceId);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(() =>
    resolveTodayWorkspaceSlotId(
      params.workspace,
      params.workspace.leadItem.planDaySlotId ?? params.workspace.leadItem.id,
    ),
  );
  const [slotStateById, setSlotStateById] = useState<Record<string, TodayWorkspaceSlotState>>(() =>
    buildInitialSlotState(params.workspace),
  );

  useEffect(() => {
    setWorkspaceState(params.workspace);
    setSourceIdState(params.sourceId);
    setSelectedSlotId((current) =>
      resolveTodayWorkspaceSlotId(
        params.workspace,
        current ?? params.workspace.leadItem.planDaySlotId ?? params.workspace.leadItem.id,
      ),
    );
    setSlotStateById((current) => ({
      ...current,
      ...buildInitialSlotState(params.workspace),
    }));
  }, [params.sourceId, params.workspace]);

  const activeSlotId = resolveTodayWorkspaceSlotId(workspaceState, selectedSlotId);
  const slotSummaries = useMemo(
    () => buildTodayWorkspaceSlotSummaries(workspaceState, slotStateById),
    [slotStateById, workspaceState],
  );
  const slotWorkspace = useMemo(
    () => buildTodaySlotWorkspace(workspaceState, activeSlotId, slotStateById[activeSlotId ?? ""]),
    [activeSlotId, slotStateById, workspaceState],
  );
  const activeSlot = getTodayWorkspaceSlot(workspaceState, activeSlotId);
  const routeFingerprint =
    resolveTodayWorkspaceSlotRouteFingerprint(
      workspaceState,
      activeSlotId,
      slotStateById[activeSlotId ?? ""],
    ) ?? workspaceState.items.map((item) => item.id).join("::");
  const draftState = initialDraftState(slotWorkspace.lessonDraft);
  const repeatTomorrowAllowed = canRepeatToTomorrow(workspaceState.date);

  useEffect(() => {
    if (!activeSlotId || !sourceIdState || !activeSlot) {
      return;
    }

    const lessonSessionId =
      activeSlot.activityBuild?.lessonSessionId ??
      activeSlot.activityState?.sessionId ??
      activeSlot.leadItem.sessionRecordId ??
      activeSlot.leadItem.workflow?.lessonSessionId ??
      undefined;
    const searchParams = new URLSearchParams({
      date: workspaceState.date,
      sourceId: sourceIdState,
      routeFingerprint,
      slotId: activeSlot.id,
    });
    if (lessonSessionId) {
      searchParams.set("lessonSessionId", lessonSessionId);
    }

    let cancelled = false;

    void fetch(`/api/today/build-status?${searchParams.toString()}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as
          | {
              ok: true;
              lessonBuild?: DailyWorkspaceLessonBuild | null;
              lessonDraft?: DailyWorkspaceLessonDraft | null;
              activityBuild?: DailyWorkspace["activityBuild"] | null;
              activityState?: DailyWorkspaceActivityState | null;
            }
          | { ok: false; error?: string };

        if (cancelled || !response.ok || !payload.ok) {
          return;
        }

        const hasServerState =
          payload.lessonBuild !== undefined ||
          payload.lessonDraft !== undefined ||
          payload.activityBuild !== undefined ||
          payload.activityState !== undefined;

        if (!hasServerState) {
          return;
        }

        setSlotStateById((current) => {
          const existing = current[activeSlotId] ?? {};
          return {
            ...current,
            [activeSlotId]: {
              ...existing,
              lessonBuild:
                payload.lessonBuild === undefined ? existing.lessonBuild : payload.lessonBuild,
              lessonDraft:
                payload.lessonDraft === undefined ? existing.lessonDraft : payload.lessonDraft,
              activityBuild:
                payload.activityBuild === undefined
                  ? existing.activityBuild
                  : payload.activityBuild,
              activityState:
                payload.activityState === undefined
                  ? existing.activityState
                  : payload.activityState,
            },
          };
        });
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[useTodayWorkspaceState:loadSlotBuildStatus]", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSlot, activeSlotId, routeFingerprint, sourceIdState, workspaceState.date]);

  async function refreshWorkspaceFromServer(date: string) {
    try {
      const patch = await fetchTodayWorkspacePatch(date);
      if (!patch) {
        return;
      }

      setWorkspaceState(patch.workspace);
      setSourceIdState(patch.sourceId);
      setSelectedSlotId((current) =>
        resolveTodayWorkspaceSlotId(patch.workspace, current ?? activeSlotId),
      );
    } catch (error) {
      console.error("[useTodayWorkspaceState:refreshWorkspaceFromServer]", error);
    }
  }

  function updateActiveSlotState(
    patch:
      | TodayWorkspaceSlotState
      | ((current: TodayWorkspaceSlotState) => TodayWorkspaceSlotState),
  ) {
    if (!activeSlotId) {
      return;
    }

    setSlotStateById((current) => {
      const existing = current[activeSlotId] ?? {};
      const next = typeof patch === "function" ? patch(existing) : { ...existing, ...patch };

      return {
        ...current,
        [activeSlotId]: next,
      };
    });
  }

  function handleItemActionSaved(result: TodayPlanItemActionResult) {
    setWorkspaceState((current) => applyTodayPlanItemActionPatch(current, result));

    if (result.needsWorkspacePatch || result.requiresWorkspaceRefresh) {
      void refreshWorkspaceFromServer(workspaceState.date);
    }
  }

  function handleEvaluationSaved(result: TodayPlanItemEvaluationResult) {
    setWorkspaceState((current) => applyTodayPlanItemEvaluationPatch(current, result));
  }

  function handleLessonPatch(patch: {
    lessonDraft?: DailyWorkspaceLessonDraft | null;
    lessonBuild?: DailyWorkspaceLessonBuild | null;
    activityBuild?: DailyWorkspace["activityBuild"] | null;
  }) {
    updateActiveSlotState((current) => ({
      ...current,
      lessonDraft: patch.lessonDraft === undefined ? current.lessonDraft : patch.lessonDraft,
      lessonBuild: patch.lessonBuild === undefined ? current.lessonBuild : patch.lessonBuild,
      activityBuild: patch.activityBuild === undefined ? current.activityBuild : patch.activityBuild,
    }));
  }

  function handleActivityPatch(patch: {
    activityBuild?: DailyWorkspace["activityBuild"] | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) {
    updateActiveSlotState((current) => ({
      ...current,
      activityBuild: patch.activityBuild === undefined ? current.activityBuild : patch.activityBuild,
      activityState: patch.activityState === undefined ? current.activityState : patch.activityState,
    }));
  }

  function handleBuildStatusPatch(patch: {
    lessonBuild?: DailyWorkspaceLessonBuild | null;
    lessonDraft?: DailyWorkspaceLessonDraft | null;
    activityBuild?: DailyWorkspace["activityBuild"] | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) {
    updateActiveSlotState((current) => ({
      ...current,
      lessonBuild: patch.lessonBuild === undefined ? current.lessonBuild : patch.lessonBuild,
      lessonDraft: patch.lessonDraft === undefined ? current.lessonDraft : patch.lessonDraft,
      activityBuild: patch.activityBuild === undefined ? current.activityBuild : patch.activityBuild,
      activityState: patch.activityState === undefined ? current.activityState : patch.activityState,
    }));
  }

  function handleRegenerationNoteChange(note: string | null) {
    updateActiveSlotState((current) => ({
      ...current,
      lessonRegenerationNote: note,
    }));
  }

  function handleExpansionIntentChange(intent: DailyWorkspace["expansionIntent"]) {
    updateActiveSlotState((current) => ({
      ...current,
      expansionIntent: intent,
    }));
  }

  function handleWorkspacePatch(patch?: TodayWorkspacePatch) {
    if (!patch) {
      return;
    }

    setWorkspaceState(patch.workspace);
    setSourceIdState(patch.sourceId);
    setSelectedSlotId((current) => resolveTodayWorkspaceSlotId(patch.workspace, current));
  }

  useTodayBuildStatusPolling({
    date: workspaceState.date,
    sourceId: sourceIdState,
    slotId: activeSlotId,
    routeFingerprint,
    lessonSessionId:
      slotWorkspace.activityBuild?.lessonSessionId ??
      slotWorkspace.activityState?.sessionId ??
      slotWorkspace.leadItem.sessionRecordId ??
      slotWorkspace.leadItem.workflow?.lessonSessionId ??
      null,
    lessonBuild: slotWorkspace.lessonBuild,
    activityBuild: slotWorkspace.activityBuild,
    onStatus: handleBuildStatusPatch,
  });

  return {
    workspaceState: slotWorkspace,
    fullWorkspaceState: workspaceState,
    sourceIdState,
    routeFingerprint,
    draftState,
    repeatTomorrowAllowed,
    slotSummaries,
    selectedSlotId: activeSlotId,
    setSelectedSlotId,
    handleItemActionSaved,
    handleEvaluationSaved,
    handleLessonPatch,
    handleActivityPatch,
    handleRegenerationNoteChange,
    handleExpansionIntentChange,
    handleWorkspacePatch,
  };
}
