"use client";

import { useEffect, useState } from "react";

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
  applyTodayActivityPatch,
  applyTodayBuildStatusPatch,
  applyTodayLessonPatch,
  applyTodayPlanItemActionPatch,
  applyTodayPlanItemEvaluationPatch,
} from "@/lib/planning/today-workspace-patches";

import { canRepeatToTomorrow, initialDraftState } from "./types";
import { useTodayBuildStatusPolling } from "./use-today-build-status-polling";
import { fetchTodayWorkspacePatch } from "./workspace-state-patches";

export function useTodayWorkspaceState(params: {
  workspace: DailyWorkspace;
  sourceId?: string;
}) {
  const [workspaceState, setWorkspaceState] = useState(params.workspace);
  const [sourceIdState, setSourceIdState] = useState(params.sourceId);

  useEffect(() => {
    setWorkspaceState(params.workspace);
    setSourceIdState(params.sourceId);
  }, [params.sourceId, params.workspace]);

  async function refreshWorkspaceFromServer(date: string) {
    try {
      const patch = await fetchTodayWorkspacePatch(date);
      if (!patch) {
        return;
      }

      setWorkspaceState(patch.workspace);
      setSourceIdState(patch.sourceId);
    } catch (error) {
      console.error("[useTodayWorkspaceState:refreshWorkspaceFromServer]", error);
    }
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
    setWorkspaceState((current) => applyTodayLessonPatch(current, patch));
  }

  function handleActivityPatch(patch: {
    activityBuild?: DailyWorkspace["activityBuild"] | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) {
    setWorkspaceState((current) => applyTodayActivityPatch(current, patch));
  }

  function handleBuildStatusPatch(patch: {
    lessonBuild?: DailyWorkspaceLessonBuild | null;
    lessonDraft?: DailyWorkspaceLessonDraft | null;
    activityBuild?: DailyWorkspace["activityBuild"] | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) {
    setWorkspaceState((current) => applyTodayBuildStatusPatch(current, patch));
  }

  function handleRegenerationNoteChange(note: string | null) {
    setWorkspaceState((current) => ({
      ...current,
      lessonRegenerationNote: note,
    }));
  }

  function handleExpansionIntentChange(intent: DailyWorkspace["expansionIntent"]) {
    setWorkspaceState((current) => ({
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
  }

  const routeFingerprint = workspaceState.items.map((item) => item.id).join("::");
  const draftState = initialDraftState(workspaceState.lessonDraft);
  const repeatTomorrowAllowed = canRepeatToTomorrow(workspaceState.date);

  useTodayBuildStatusPolling({
    date: workspaceState.date,
    sourceId: sourceIdState,
    routeFingerprint,
    lessonSessionId:
      workspaceState.activityBuild?.lessonSessionId ??
      workspaceState.activityState?.sessionId ??
      workspaceState.leadItem.sessionRecordId ??
      workspaceState.leadItem.workflow?.lessonSessionId ??
      null,
    lessonBuild: workspaceState.lessonBuild,
    activityBuild: workspaceState.activityBuild,
    onStatus: handleBuildStatusPatch,
  });

  return {
    workspaceState,
    sourceIdState,
    routeFingerprint,
    draftState,
    repeatTomorrowAllowed,
    handleItemActionSaved,
    handleEvaluationSaved,
    handleLessonPatch,
    handleActivityPatch,
    handleRegenerationNoteChange,
    handleExpansionIntentChange,
    handleWorkspacePatch,
  };
}
