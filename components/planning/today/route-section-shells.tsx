"use client";

import dynamic from "next/dynamic";

import { Card } from "@/components/ui/card";
import type {
  DailyWorkspace,
  DailyWorkspaceActivityState,
  DailyWorkspaceLessonBuild,
  DailyWorkspaceLessonDraft,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";
import {
  saveTodayPlanItemEvaluationAction,
  updateTodayPlanItemAction,
  type TodayWorkspacePatch,
} from "@/app/(parent)/today/actions";

import { TodayItemLearnerLink, TodayPlanItemActionButtons } from "./item-action-control";
import type { DraftState } from "./types";
import {
  formatPlannerDate,
} from "./types";

const DeferredLessonPlanPanel = dynamic(
  () =>
    import("@/components/planning/lesson-plan-panel").then(
      (module) => module.LessonPlanPanel,
    ),
  {
    loading: () => (
      <Card className="quiet-panel">
        <div className="space-y-4 p-5">
          <div className="h-4 w-20 rounded bg-muted/80" />
          <div className="h-8 w-full rounded bg-muted/60" />
          <div className="h-44 w-full rounded bg-muted/40" />
        </div>
      </Card>
    ),
  },
);

export function TodayRouteItemsSection({
  workspace,
  repeatTomorrowAllowed = false,
  onActionSaved,
  onEvaluationSaved,
  compact = false,
}: {
  workspace: DailyWorkspace;
  repeatTomorrowAllowed?: boolean;
  compact?: boolean;
  onActionSaved: (result: Awaited<ReturnType<typeof updateTodayPlanItemAction>>) => void;
  onEvaluationSaved: (result: Awaited<ReturnType<typeof saveTodayPlanItemEvaluationAction>>) => void;
}) {
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  if (compact) {
    return (
      <section className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Queue
          </p>
          <p className="text-sm text-muted-foreground">
            {workspace.items.length} items · {totalMinutes} min
          </p>
        </div>

        <div className="space-y-2">
          {workspace.items.map((item) => {
            const alternate = workspace.alternatesByPlanItemId[item.id]?.[0];

            return (
              <Card key={item.id} className="quiet-panel">
                <div className="space-y-3 p-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium leading-5 text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.objective}</p>
                  </div>
                  <div className="pt-1">
                    <TodayItemLearnerLink item={item} />
                  </div>
                  <TodayPlanItemActionButtons
                    item={item}
                    date={workspace.date}
                    alternateWeeklyRouteItemId={alternate?.id}
                    repeatTomorrowAllowed={repeatTomorrowAllowed}
                    compact
                    onActionSaved={onActionSaved}
                    onEvaluationSaved={onEvaluationSaved}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{formatPlannerDate(workspace.date)}</p>
          <h2 className="font-serif text-2xl">Queue</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{workspace.items.length} items</span>
          <span>{totalMinutes} min</span>
        </div>
      </div>

      <div className="space-y-3">
        {workspace.items.map((item) => {
          const alternate = workspace.alternatesByPlanItemId[item.id]?.[0];

          return (
            <Card
              key={item.id}
              className={cn(
                "quiet-panel",
                item.status === "completed" || item.completionStatus === "completed_as_planned"
                  ? "border-primary/30 bg-primary/5"
                  : undefined,
              )}
            >
              <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="space-y-1">
                      <h3 className="font-serif text-xl leading-tight">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.objective}</p>
                    </div>
                    {item.note ? <p className="text-sm text-muted-foreground">{item.note}</p> : null}
                    <TodayItemLearnerLink item={item} />
                  </div>

                  <TodayPlanItemActionButtons
                    item={item}
                    date={workspace.date}
                    alternateWeeklyRouteItemId={alternate?.id}
                    repeatTomorrowAllowed={repeatTomorrowAllowed}
                    onActionSaved={onActionSaved}
                    onEvaluationSaved={onEvaluationSaved}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function TodayLessonPlanSection({
  workspace,
  sourceId,
  routeFingerprint,
  slotId,
  slotLabel,
  slotPosition,
  daySkillCount,
  daySlotCount,
  draftState,
  buildState,
  activityBuild,
  activityState,
  lessonSessionId,
  onLessonPatch,
  onActivityPatch,
  onExpansionIntentChange,
  onWorkspacePatch,
  showDraftOutput = true,
  compact = false,
}: {
  workspace: DailyWorkspace;
  sourceId?: string;
  routeFingerprint: string;
  slotId?: string;
  slotLabel?: string;
  slotPosition?: number;
  daySkillCount?: number;
  daySlotCount?: number;
  draftState?: DraftState;
  buildState?: DailyWorkspaceLessonBuild | null;
  activityBuild?: DailyWorkspace["activityBuild"] | null;
  activityState?: DailyWorkspaceActivityState | null;
  lessonSessionId?: string;
  onLessonPatch?: (patch: {
    lessonDraft?: DailyWorkspaceLessonDraft | null;
    lessonBuild?: DailyWorkspaceLessonBuild | null;
    activityBuild?: DailyWorkspace["activityBuild"] | null;
  }) => void;
  onActivityPatch?: (patch: {
    activityBuild?: DailyWorkspace["activityBuild"] | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) => void;
  onExpansionIntentChange?: (intent: DailyWorkspace["expansionIntent"]) => void;
  onWorkspacePatch?: (patch?: TodayWorkspacePatch) => void;
  showDraftOutput?: boolean;
  compact?: boolean;
}) {
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const resolvedSlotId =
    slotId ??
    workspace.leadItem.planDaySlotId ??
    workspace.slots.find((slot) => slot.leadItem.id === workspace.leadItem.id)?.id ??
    workspace.slots[0]?.id ??
    routeFingerprint;
  const contextKey = JSON.stringify({
    date: workspace.date,
    sourceId,
    slotId: resolvedSlotId,
    leadItemId: workspace.leadItem.id,
    objectives: workspace.sessionTargets,
    routeItems: workspace.items.map((item) => ({
      id: item.id,
      title: item.title,
      objective: item.objective,
      lessonLabel: item.lessonLabel,
    })),
  });

  return (
    <div className={cn(compact && "xl:sticky xl:top-24")}>
      <DeferredLessonPlanPanel
        key={contextKey}
        date={workspace.date}
        sourceId={sourceId}
        slotId={resolvedSlotId}
        slotLabel={slotLabel}
        slotPosition={slotPosition}
        routeFingerprint={routeFingerprint}
        sourceTitle={workspace.leadItem.sourceLabel}
        routeItemCount={workspace.items.length}
        totalMinutes={totalMinutes}
        daySkillCount={daySkillCount}
        daySlotCount={daySlotCount}
        objectiveCount={workspace.sessionTargets.length}
        objectives={workspace.sessionTargets}
        routeItemTitles={workspace.items.map((item) => item.title)}
        draftState={draftState ?? null}
        buildState={buildState ?? null}
        activityBuild={activityBuild ?? null}
        activityState={activityState ?? null}
        lessonSessionId={lessonSessionId}
        expansionIntent={workspace.expansionIntent}
        onLessonPatch={onLessonPatch}
        onActivityPatch={onActivityPatch}
        onExpansionIntentChange={onExpansionIntentChange}
        onWorkspacePatch={onWorkspacePatch}
        showDraftOutput={showDraftOutput}
      />
    </div>
  );
}
