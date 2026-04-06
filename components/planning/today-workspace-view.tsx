"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LessonPlanPanel } from "@/components/planning/lesson-plan-panel";
import {
  LessonDraftRenderer,
  LegacyLessonDraftNotice,
} from "@/components/planning/lesson-draft-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import type { DailyWorkspace, DailyWorkspaceLessonDraft } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

interface TodayWorkspaceViewProps {
  workspace: DailyWorkspace;
  sourceId?: string;
}

interface TodayRouteItemsSectionProps {
  workspace: DailyWorkspace;
  sourceId?: string;
  repeatTomorrowAllowed?: boolean;
}

function formatMinutes(minutes: number) {
  return `${minutes} min`;
}

function formatPlannerDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function getStatusLabel(status: string) {
  return status.replace("_", " ");
}

function getReviewLabel(reviewState?: string | null) {
  if (!reviewState || reviewState === "not_required") {
    return null;
  }

  return reviewState.replaceAll("_", " ");
}

function canRepeatToTomorrow(date: string) {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 4;
}

// Typed draft state: can hold structured, legacy markdown, or null
type DraftState =
  | { kind: "structured"; draft: StructuredLessonDraft }
  | { kind: "markdown"; markdown: string }
  | null;

function initialDraftState(lessonDraft: DailyWorkspaceLessonDraft | null): DraftState {
  if (!lessonDraft) return null;
  if (lessonDraft.structured) {
    return { kind: "structured", draft: lessonDraft.structured };
  }
  if (lessonDraft.markdown) {
    return { kind: "markdown", markdown: lessonDraft.markdown };
  }
  return null;
}

export function TodayWorkspaceView({ workspace, sourceId }: TodayWorkspaceViewProps) {
  const [draftState, setDraftState] = useState<DraftState>(
    () => initialDraftState(workspace.lessonDraft),
  );
  const repeatTomorrowAllowed = canRepeatToTomorrow(workspace.date);

  useEffect(() => {
    setDraftState(initialDraftState(workspace.lessonDraft));
  }, [workspace.date, workspace.leadItem.id, workspace.lessonDraft, sourceId]);

  function handleDraftChange(incoming: StructuredLessonDraft | string | null) {
    if (incoming === null) {
      setDraftState(null);
    } else if (typeof incoming === "string") {
      setDraftState({ kind: "markdown", markdown: incoming });
    } else {
      setDraftState({ kind: "structured", draft: incoming });
    }
  }

  if (workspace.items.length === 0) {
    return (
      <Card className="border-dashed">
        <div className="flex flex-col gap-4 p-6">
          <div>
            <p className="text-sm text-muted-foreground">{formatPlannerDate(workspace.date)}</p>
            <h2 className="mt-1 font-serif text-2xl">{workspace.learner.name}</h2>
          </div>
          <p className="text-sm text-muted-foreground">No route items are ready for today.</p>
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

  if (draftState) {
    return (
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:items-start">
        <TodayRouteItemsSection
          workspace={workspace}
          sourceId={sourceId}
          repeatTomorrowAllowed={repeatTomorrowAllowed}
          compact
        />
        <TodayLessonDraftArticle workspace={workspace} draftState={draftState} />
        <TodayLessonPlanSection
          workspace={workspace}
          sourceId={sourceId}
          draftState={draftState}
          onDraftChange={handleDraftChange}
          showDraftOutput={false}
          compact
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)] xl:items-start">
      <TodayRouteItemsSection
        workspace={workspace}
        sourceId={sourceId}
        repeatTomorrowAllowed={repeatTomorrowAllowed}
      />
      <TodayLessonPlanSection
        workspace={workspace}
        sourceId={sourceId}
        draftState={null}
        onDraftChange={handleDraftChange}
      />
    </div>
  );
}

export function TodayRouteItemsSection({
  workspace,
  sourceId,
  repeatTomorrowAllowed = false,
  compact = false,
}: TodayRouteItemsSectionProps & { compact?: boolean }) {
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  if (compact) {
    return (
      <section className="space-y-4 xl:sticky xl:top-24">
        <div className="border-b border-border/70 pb-4">
          <p className="text-sm text-muted-foreground">{formatPlannerDate(workspace.date)}</p>
          <h2 className="font-serif text-2xl">Route</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {workspace.items.length} items · {totalMinutes} min
          </p>
        </div>

        <div className="space-y-2">
          {workspace.items.map((item, index) => {
            const alternate = workspace.alternatesByPlanItemId[item.id]?.[0];

            return (
              <Card key={item.id}>
                <div className="space-y-3 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <Badge variant="outline">{item.subject}</Badge>
                    <span>{formatMinutes(item.estimatedMinutes)}</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium leading-5 text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.objective}</p>
                  </div>
                  {item.workflow ? (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{item.workflow.activityCount} activities</span>
                      <span>{item.workflow.evidenceCount} evidence</span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {item.sessionRecordId ? (
                      <Link
                        href={`/activity/${item.sessionRecordId}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Open activity
                      </Link>
                    ) : null}
                    <Link
                      href={`/today?date=${workspace.date}&action=complete&planItemId=${item.id}`}
                      className={buttonVariants({ variant: "default", size: "sm" })}
                    >
                      Complete
                    </Link>
                    {repeatTomorrowAllowed ? (
                      <Link
                        href={`/today?date=${workspace.date}&action=repeat_tomorrow&planItemId=${item.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Repeat
                      </Link>
                    ) : null}
                    {alternate ? (
                      <Link
                        href={`/today?date=${workspace.date}&action=swap_with_alternate&planItemId=${item.id}&alternateWeeklyRouteItemId=${alternate.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
                      >
                        Swap
                      </Link>
                    ) : null}
                  </div>
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
          <h2 className="font-serif text-2xl">Daily plan</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{workspace.items.length} items</span>
          <span>{totalMinutes} min</span>
          <span>{workspace.sessionTargets.length} targets</span>
        </div>
      </div>

      <div className="space-y-3">
        {workspace.items.map((item, index) => {
          const alternate = workspace.alternatesByPlanItemId[item.id]?.[0];

          return (
            <Card key={item.id}>
              <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Badge variant="outline">{item.subject}</Badge>
                      <Badge variant="outline">{formatMinutes(item.estimatedMinutes)}</Badge>
                      {item.status !== "ready" ? <Badge>{getStatusLabel(item.status)}</Badge> : null}
                      {item.completionStatus && item.completionStatus !== "not_started" ? (
                        <Badge variant="secondary">{getStatusLabel(item.completionStatus)}</Badge>
                      ) : null}
                      {getReviewLabel(item.reviewState) ? (
                        <Badge variant="outline">{getReviewLabel(item.reviewState)}</Badge>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-serif text-xl leading-tight">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.objective}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.lessonLabel}</p>
                    {item.workflow ? (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{item.workflow.activityCount} activities</span>
                        <span>{item.workflow.evidenceCount} evidence</span>
                      </div>
                    ) : null}
                    {item.note ? <p className="text-sm text-muted-foreground">{item.note}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {item.sessionRecordId ? (
                      <Link
                        href={`/activity/${item.sessionRecordId}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Open activity
                      </Link>
                    ) : null}
                    <Link
                      href={`/today?date=${workspace.date}&action=complete&planItemId=${item.id}`}
                      className={buttonVariants({ variant: "default", size: "sm" })}
                    >
                      Complete
                    </Link>
                    <Link
                      href={`/today?date=${workspace.date}&action=push_to_tomorrow&planItemId=${item.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Tomorrow
                    </Link>
                    {repeatTomorrowAllowed ? (
                      <Link
                        href={`/today?date=${workspace.date}&action=repeat_tomorrow&planItemId=${item.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Repeat
                      </Link>
                    ) : null}
                    {alternate ? (
                      <Link
                        href={`/today?date=${workspace.date}&action=swap_with_alternate&planItemId=${item.id}&alternateWeeklyRouteItemId=${alternate.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
                      >
                        Swap
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function TodayLessonDraftArticle({
  workspace,
  draftState,
}: {
  workspace: DailyWorkspace;
  draftState: DraftState & { kind: string };
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-border/70 pb-4">
        <p className="text-sm text-muted-foreground">{workspace.leadItem.sourceLabel}</p>
        <h2 className="font-serif text-3xl">Lesson draft</h2>
      </div>

      <Card>
        <div className="p-5 sm:p-6">
          {draftState.kind === "structured" ? (
            <LessonDraftRenderer draft={draftState.draft} />
          ) : draftState.kind === "markdown" ? (
            <div className="space-y-4">
              <LegacyLessonDraftNotice />
              <MarkdownContent content={draftState.markdown} />
            </div>
          ) : null}
        </div>
      </Card>
    </section>
  );
}

export function TodayLessonPlanSection({
  workspace,
  sourceId,
  draftState,
  onDraftChange,
  showDraftOutput = true,
  compact = false,
}: TodayWorkspaceViewProps & {
  draftState?: DraftState;
  onDraftChange?: (draft: StructuredLessonDraft | string | null) => void;
  showDraftOutput?: boolean;
  compact?: boolean;
}) {
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const contextKey = JSON.stringify({
    date: workspace.date,
    sourceId,
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
      <LessonPlanPanel
        key={contextKey}
        date={workspace.date}
        sourceId={sourceId}
        sourceTitle={workspace.leadItem.sourceLabel}
        routeItemCount={workspace.items.length}
        totalMinutes={totalMinutes}
        objectiveCount={workspace.sessionTargets.length}
        objectives={workspace.sessionTargets}
        routeItemTitles={workspace.items.map((item) => item.title)}
        draftState={draftState ?? null}
        onDraftChange={onDraftChange}
        showDraftOutput={showDraftOutput}
      />
    </div>
  );
}
