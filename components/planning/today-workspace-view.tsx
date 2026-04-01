"use client";

import Link from "next/link";

import { LessonPlanPanel } from "@/components/planning/lesson-plan-panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DailyWorkspace } from "@/lib/planning/types";

interface TodayWorkspaceViewProps {
  workspace: DailyWorkspace;
  sourceId?: string;
}

interface TodayRouteItemsSectionProps {
  workspace: DailyWorkspace;
  sourceId?: string;
  embedded?: boolean;
}

function formatMinutes(minutes: number) {
  return `${minutes} min`;
}

function formatPlannerDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function TodayWorkspaceView({ workspace, sourceId }: TodayWorkspaceViewProps) {
  if (workspace.items.length === 0) {
    return (
      <Card className="border-border/70 bg-card/88">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{formatPlannerDate(workspace.date)}</Badge>
            <Badge variant="secondary">{workspace.learner.name}</Badge>
          </div>
          <CardTitle className="font-serif text-2xl sm:text-3xl">{workspace.headline}</CardTitle>
          <CardDescription>
            No route items are available for this learner and source yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Link href="/curriculum" className={buttonVariants({ variant: "default", size: "sm" })}>
            Open curriculum
          </Link>
          <span className="text-sm text-muted-foreground">
            Import curriculum and generate a weekly route to populate today.
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <TodayRouteItemsSection workspace={workspace} sourceId={sourceId} />
      <TodayLessonPlanSection workspace={workspace} sourceId={sourceId} />
    </div>
  );
}

export function TodayRouteItemsSection({
  workspace,
  sourceId,
  embedded = false,
}: TodayRouteItemsSectionProps) {
  const containerClassName = embedded
    ? "mt-4 border-t border-border/60 pt-4"
    : "overflow-hidden rounded-3xl border border-border/70 bg-card/88 shadow-sm";

  const headerClassName = embedded
    ? "flex flex-wrap items-end justify-between gap-3 px-1 pb-4"
    : "flex flex-wrap items-end justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6";

  const itemClassName = embedded ? "py-6" : "px-5 py-6 sm:px-6";

  return (
    <section className={containerClassName}>
      <div className={headerClassName}>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Today&apos;s curriculum</p>
          <h3 className="mt-1 font-serif text-2xl">Route items</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          The day stays in one reading flow so the route and lesson draft can work together.
        </p>
      </div>

      <ul className="divide-y divide-border/60">
        {workspace.items.map((item) => (
          <li key={item.id} className={itemClassName}>
            <article className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.subject}</Badge>
                <Badge variant="outline">{formatMinutes(item.estimatedMinutes)}</Badge>
                {item.status !== "ready" ? (
                  <Badge variant="outline">{item.status.replace("_", " ")}</Badge>
                ) : null}
              </div>

              <div className="space-y-2">
                <CardTitle className="font-serif text-xl leading-tight">{item.title}</CardTitle>
                <CardDescription className="text-sm leading-6">{item.objective}</CardDescription>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]">
                <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-sm">
                  <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Path
                  </span>
                  <p className="mt-1 break-words leading-6 text-muted-foreground">
                    {item.lessonLabel}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-sm">
                  <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Daily objective
                  </span>
                  <p className="mt-1 leading-6 text-muted-foreground">{item.objective}</p>
                </div>
              </div>

              {item.note ? (
                <div className="text-xs leading-6 text-muted-foreground" title={item.note}>
                  {item.note}
                </div>
              ) : null}

              {item.curriculum ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/today?date=${workspace.date}${sourceId ? `&sourceId=${sourceId}` : ""}&action=complete&planItemId=${item.id}`}
                    className={buttonVariants({ variant: "default", size: "sm" })}
                  >
                    Complete
                  </Link>
                  <Link
                    href={`/today?date=${workspace.date}${sourceId ? `&sourceId=${sourceId}` : ""}&action=push_to_tomorrow&planItemId=${item.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Push
                  </Link>
                  {workspace.alternatesByPlanItemId[item.id]?.[0] ? (
                    <Link
                      href={`/today?date=${workspace.date}${sourceId ? `&sourceId=${sourceId}` : ""}&action=swap_with_alternate&planItemId=${item.id}&alternateWeeklyRouteItemId=${workspace.alternatesByPlanItemId[item.id][0].id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Swap
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TodayLessonPlanSection({ workspace, sourceId }: TodayWorkspaceViewProps) {
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
    <div>
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
      />
    </div>
  );
}
