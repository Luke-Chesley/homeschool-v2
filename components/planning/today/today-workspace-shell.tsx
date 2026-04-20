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
  onExpansionIntentChange: (intent: DailyWorkspace["expansionIntent"]) => void;
  onWorkspacePatch: (patch?: TodayWorkspacePatch) => void;
}) {
  const [startNextError, setStartNextError] = useState<string | null>(null);
  const [startNextMessage, setStartNextMessage] = useState<string | null>(null);
  const [isStartingNext, startNextTransition] = useTransition();
  const activeSlotId =
    selectedSlotId ?? workspace.leadItem.planDaySlotId ?? workspace.slots[0]?.id ?? null;

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
        <section className="space-y-4 border-b border-border/70 pb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Today’s lesson flow</p>
              <p className="text-sm text-muted-foreground">
                Keep the active lesson in focus. Switch slots only when you need the next same-day lesson.
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
          <div className="flex flex-wrap gap-2">
            {slotSummaries.map((slot, index) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => onSelectSlot(slot.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-left transition-colors",
                  selectedSlotId === slot.id
                    ? "border-primary bg-primary/6 text-foreground"
                    : "border-border/70 bg-background/70 text-muted-foreground hover:border-primary/40",
                )}
              >
                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Slot {index + 1}
                </span>
                <span className="mt-1 block text-sm font-medium text-foreground">{slot.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{getSlotStatusLabel(slot)}</span>
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
        </section>
      ) : null}

      {draftState ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="space-y-4">
            <TodayLessonDraftCard
              workspace={workspace}
              draftState={draftState}
              onEvaluationSaved={onEvaluationSaved}
            />

            <details className="rounded-[var(--radius)] border border-border/70 bg-card/70">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground">
                Today’s queue and actions
              </summary>
              <div className="border-t border-border/70 px-4 py-4">
                <TodayRouteItemsSection
                  workspace={workspace}
                  repeatTomorrowAllowed={repeatTomorrowAllowed}
                  compact
                  onActionSaved={onItemActionSaved}
                  onEvaluationSaved={onEvaluationSaved}
                />
              </div>
            </details>
          </div>

          <TodayLessonPlanSection
            workspace={workspace}
            sourceId={sourceId}
            slotId={activeSlotId ?? undefined}
            routeFingerprint={routeFingerprint}
            draftState={draftState}
            buildState={workspace.lessonBuild}
            activityBuild={workspace.activityBuild}
            activityState={workspace.activityState}
            lessonSessionId={
              workspace.leadItem.sessionRecordId ??
              workspace.leadItem.workflow?.lessonSessionId ??
              undefined
            }
            onLessonPatch={onLessonPatch}
            onActivityPatch={onActivityPatch}
            onExpansionIntentChange={onExpansionIntentChange}
            onWorkspacePatch={onWorkspacePatch}
            showDraftOutput={false}
            compact
          />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <TodayLessonPlanSection
            workspace={workspace}
            sourceId={sourceId}
            slotId={activeSlotId ?? undefined}
            routeFingerprint={routeFingerprint}
            draftState={null}
            buildState={workspace.lessonBuild}
            activityBuild={workspace.activityBuild}
            activityState={workspace.activityState}
            lessonSessionId={
              workspace.leadItem.sessionRecordId ??
              workspace.leadItem.workflow?.lessonSessionId ??
              undefined
            }
            onLessonPatch={onLessonPatch}
            onActivityPatch={onActivityPatch}
            onExpansionIntentChange={onExpansionIntentChange}
            onWorkspacePatch={onWorkspacePatch}
          />
          <details className="rounded-[var(--radius)] border border-border/70 bg-card/70" open>
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground">
              Today’s queue and actions
            </summary>
            <div className="border-t border-border/70 px-4 py-4">
              <TodayRouteItemsSection
                workspace={workspace}
                repeatTomorrowAllowed={repeatTomorrowAllowed}
                compact
                onActionSaved={onItemActionSaved}
                onEvaluationSaved={onEvaluationSaved}
              />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
