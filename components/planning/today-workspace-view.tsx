"use client";

import Link from "next/link";
import { type CSSProperties } from "react";

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

function clampStyle(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

function collectMaterials(items: DailyWorkspace["items"]) {
  const materials = new Set<string>();

  for (const item of items) {
    for (const material of item.materials) {
      materials.add(material);
    }
  }

  return [...materials].slice(0, 5);
}

export function TodayWorkspaceView({ workspace, sourceId }: TodayWorkspaceViewProps) {
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const materials = collectMaterials(workspace.items);

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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
      <div className="grid gap-6">
        <Card className="border-border/70 bg-card/88">
          <CardContent className="flex flex-col gap-5 p-6 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{formatPlannerDate(workspace.date)}</Badge>
              <Badge variant="secondary">{workspace.learner.name}</Badge>
              <Badge variant="outline">{workspace.leadItem.sourceLabel}</Badge>
            </div>

            <div className="max-w-3xl space-y-3">
              <h2 className="font-serif text-3xl leading-[0.95] tracking-[-0.04em] sm:text-4xl">
                {workspace.headline}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Focus on the current route, then generate a lesson plan from today&apos;s objectives
                when you are ready to teach.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{workspace.items.length} route items</Badge>
              <Badge variant="secondary">{formatMinutes(totalMinutes)}</Badge>
              <Badge variant="secondary">
                {workspace.sessionTargets.length} objective
                {workspace.sessionTargets.length === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/curriculum${sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : ""}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Review curriculum
              </Link>
              <span className="text-sm text-muted-foreground">
                The lesson plan lives in the side panel so the route stays visible.
              </span>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today&apos;s curriculum</p>
              <h3 className="mt-1 font-serif text-2xl">All route items in one place</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Cards stay compact so the full day remains visible at a glance.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workspace.items.map((item) => (
              <Card key={item.id} className="border-border/70 bg-card/88">
                <CardHeader className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.subject}</Badge>
                    <Badge variant="outline">{formatMinutes(item.estimatedMinutes)}</Badge>
                    {item.status !== "ready" ? (
                      <Badge variant="outline">{item.status.replace("_", " ")}</Badge>
                    ) : null}
                  </div>
                  <CardTitle className="font-serif text-xl leading-tight" style={clampStyle(2)}>
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-6" style={clampStyle(2)}>
                    {item.objective}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0">
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-background/75 px-3 py-2 text-sm">
                    <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      Path
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-muted-foreground"
                      title={item.lessonLabel}
                    >
                      {item.lessonLabel}
                    </span>
                  </div>

                  {item.note ? (
                    <div className="truncate text-xs text-muted-foreground" title={item.note}>
                      {item.note}
                    </div>
                  ) : null}

                  {item.curriculum ? (
                    <div className="flex flex-wrap gap-2">
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
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <div className="self-start xl:sticky xl:top-4">
        <LessonPlanPanel
          date={workspace.date}
          sourceId={sourceId}
          sourceTitle={workspace.leadItem.sourceLabel}
          routeItemCount={workspace.items.length}
          totalMinutes={totalMinutes}
          objectiveCount={workspace.sessionTargets.length}
          leadItemTitle={workspace.leadItem.title}
          leadItemObjective={workspace.leadItem.objective}
          objectives={workspace.sessionTargets}
        />
      </div>
    </div>
  );
}
