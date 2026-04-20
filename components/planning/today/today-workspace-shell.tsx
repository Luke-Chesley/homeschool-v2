"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  startNextLessonTodayAction,
  type TodayPlanItemActionResult,
  type TodayPlanItemEvaluationResult,
  type TodayWorkspacePatch,
} from "@/app/(parent)/today/actions";
import type {
  DailyWorkspace,
  DailyWorkspaceActivityState,
  DailyWorkspaceLessonBuild,
  DailyWorkspaceLessonDraft,
} from "@/lib/planning/types";
import type { TodayWorkspaceSlotSummary } from "@/lib/planning/today-workspace-patches";
import { cn } from "@/lib/utils";

import { TodayLearnerActivityBridge } from "./activity-build-control";
import { TodayLessonDraftCard } from "./today-lesson-draft-card";
import {
  TodayLessonPlanSection,
  TodayRouteItemsSection,
} from "./route-section-shells";
import type { DraftState } from "./types";

function getSlotStatusLabel(slot: TodayWorkspaceSlotSummary) {
  if (slot.activityStatus === "ready") {
    return "activity ready";
  }

  if (slot.activityStatus === "stale") {
    return "activity stale";
  }

  if (slot.lessonBuildStatus === "generating" || slot.lessonBuildStatus === "queued") {
    return "building draft";
  }

  if (slot.hasDraft) {
    return "draft ready";
  }

  return `${slot.estimatedMinutes} min`;
}

export function TodayWorkspaceShell({
  workspace,
  fullWorkspace,
  sourceId,
  routeFingerprint,
  draftState,
  repeatTomorrowAllowed,
  slotSummaries,
  selectedSlotId,
  onSelectSlot,
  onItemActionSaved,
  onEvaluationSaved,
  onLessonPatch,
  onActivityPatch,
  onRegenerationNoteChange,
  onExpansionIntentChange,
  onWorkspacePatch,
}: {
  workspace: DailyWorkspace;
  fullWorkspace: DailyWorkspace;
  sourceId?: string;
  routeFingerprint: string;
  draftState: DraftState;
  repeatTomorrowAllowed: boolean;
  slotSummaries: TodayWorkspaceSlotSummary[];
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string | null) => void;
  onItemActionSaved: (result: TodayPlanItemActionResult) => void;
  onEvaluationSaved: (result: TodayPlanItemEvaluationResult) => void;
  onLessonPatch: (patch: {
    lessonDraft?: DailyWorkspaceLessonDraft | null;
    lessonBuild?: DailyWorkspaceLessonBuild | null;
    activityBuild?: DailyWorkspace["activityBuild"] | null;
  }) => void;
  onActivityPatch: (patch: {
    activityBuild?: DailyWorkspace["activityBuild"] | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) => void;
  onRegenerationNoteChange: (note: string | null) => void;
  onExpansionIntentChange: (intent: DailyWorkspace["expansionIntent"]) => void;
  onWorkspacePatch: (patch?: TodayWorkspacePatch) => void;
}) {
  const [startNextError, setStartNextError] = useState<string | null>(null);
  const [startNextMessage, setStartNextMessage] = useState<string | null>(null);
  const [isStartingNext, startNextTransition] = useTransition();

  if (fullWorkspace.items.length === 0) {
    return (
      <Card className="quiet-panel max-w-4xl border-dashed">
        <div className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="mt-1 font-serif text-2xl">Nothing is queued for today.</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            No route items are ready for {fullWorkspace.learner.name} today. Open curriculum or planning
            to shape the next workable day.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/curriculum" className={buttonVariants({ variant: "default", size: "sm" })}>
              Open curriculum
            </Link>
            <Link href="/planning" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open planning
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  function handleStartNextLesson() {
    if (!sourceId) {
      setStartNextError("No curriculum source is available for this learner.");
      setStartNextMessage(null);
      return;
    }

    setStartNextError(null);
    setStartNextMessage(null);
    startNextTransition(async () => {
      const result = await startNextLessonTodayAction({
        date: fullWorkspace.date,
        sourceId,
      });

      if (!result.ok) {
        setStartNextError(result.error ?? "Could not add the next lesson to today.");
        return;
      }

      onWorkspacePatch(result.workspacePatch);
      if (result.startedSlotId) {
        onSelectSlot(result.startedSlotId);
      }
      setStartNextMessage(result.message ?? "Pulled the next lesson into today.");
    });
  }

  return (
    <div className="space-y-6">
      {slotSummaries.length > 1 || sourceId ? (
        <Card className="quiet-panel">
          <div className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Lesson slots</p>
                <p className="text-sm text-muted-foreground">
                  Switch between today&apos;s same-day lessons. Drafts and activities are tracked per slot.
                </p>
              </div>
              {sourceId ? (
                <button
                  type="button"
                  onClick={handleStartNextLesson}
                  disabled={isStartingNext}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "min-h-11 w-full justify-center lg:min-h-8 lg:w-auto",
                  )}
                >
                  {isStartingNext ? <Loader2 className="size-4 animate-spin" /> : null}
                  Pull next lesson into today
                </button>
              ) : null}
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {slotSummaries.map((slot, index) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSelectSlot(slot.id)}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left transition-colors",
                    selectedSlotId === slot.id
                      ? "border-primary bg-primary/5"
                      : "border-border/70 bg-background/70 hover:border-primary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Slot {index + 1}
                      </p>
                      <p className="truncate text-sm font-medium text-foreground">{slot.title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{slot.subject}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{getSlotStatusLabel(slot)}</p>
                </button>
              ))}
            </div>
            {startNextMessage ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                {startNextMessage}
              </div>
            ) : null}
            {startNextError ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {startNextError}
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <TodayLearnerActivityBridge
        workspace={workspace}
        draftState={draftState}
        sourceId={sourceId}
        slotId={workspace.leadItem.id}
        routeFingerprint={routeFingerprint}
        onActivityPatch={onActivityPatch}
      />

      {draftState ? (
        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_20rem] xl:items-start">
          <TodayRouteItemsSection
            workspace={workspace}
            repeatTomorrowAllowed={repeatTomorrowAllowed}
            compact
            onActionSaved={onItemActionSaved}
            onEvaluationSaved={onEvaluationSaved}
          />
          <TodayLessonDraftCard
            workspace={workspace}
            draftState={draftState}
            onEvaluationSaved={onEvaluationSaved}
          />
          <TodayLessonPlanSection
            workspace={workspace}
            sourceId={sourceId}
            routeFingerprint={routeFingerprint}
            draftState={draftState}
            buildState={workspace.lessonBuild}
            onLessonPatch={onLessonPatch}
            onRegenerationNoteChange={onRegenerationNoteChange}
            onExpansionIntentChange={onExpansionIntentChange}
            onWorkspacePatch={onWorkspacePatch}
            showDraftOutput={false}
            compact
          />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)] xl:items-start">
          <TodayRouteItemsSection
            workspace={workspace}
            repeatTomorrowAllowed={repeatTomorrowAllowed}
            onActionSaved={onItemActionSaved}
            onEvaluationSaved={onEvaluationSaved}
          />
          <TodayLessonPlanSection
            workspace={workspace}
            sourceId={sourceId}
            routeFingerprint={routeFingerprint}
            draftState={null}
            buildState={workspace.lessonBuild}
            onLessonPatch={onLessonPatch}
            onRegenerationNoteChange={onRegenerationNoteChange}
            onExpansionIntentChange={onExpansionIntentChange}
            onWorkspacePatch={onWorkspacePatch}
          />
        </div>
      )}
    </div>
  );
}
