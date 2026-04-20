"use client";

import type { DailyWorkspace } from "@/lib/planning/types";

import { TodayWorkspaceShell } from "./today/today-workspace-shell";
import { useTodayWorkspaceState } from "./today/use-today-workspace-state";

interface TodayWorkspaceViewProps {
  workspace: DailyWorkspace;
  sourceId?: string;
}

export function TodayWorkspaceView({ workspace, sourceId }: TodayWorkspaceViewProps) {
  const state = useTodayWorkspaceState({ workspace, sourceId });

  return (
    <TodayWorkspaceShell
      workspace={state.workspaceState}
      fullWorkspace={state.fullWorkspaceState}
      sourceId={state.sourceIdState}
      routeFingerprint={state.routeFingerprint}
      draftState={state.draftState}
      repeatTomorrowAllowed={state.repeatTomorrowAllowed}
      slotSummaries={state.slotSummaries}
      selectedSlotId={state.selectedSlotId}
      onSelectSlot={state.setSelectedSlotId}
      onItemActionSaved={state.handleItemActionSaved}
      onEvaluationSaved={state.handleEvaluationSaved}
      onLessonPatch={state.handleLessonPatch}
      onActivityPatch={state.handleActivityPatch}
      onRegenerationNoteChange={state.handleRegenerationNoteChange}
      onExpansionIntentChange={state.handleExpansionIntentChange}
      onWorkspacePatch={state.handleWorkspacePatch}
    />
  );
}
