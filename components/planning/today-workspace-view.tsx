"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

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

function buildLessonPlanPreview(workspace: DailyWorkspace) {
  const leadItem = workspace.leadItem;
  const materials = collectMaterials(workspace.items);
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  return [
    {
      title: "Objective",
      body:
        workspace.sessionTargets[0] ??
        `Start with ${leadItem.title.toLowerCase()} and keep the work tied to today's route.`,
    },
    {
      title: "Warm-up",
      body: `Review ${leadItem.lessonLabel.toLowerCase()} and surface the prior skill before moving into the main lesson.`,
    },
    {
      title: "Core work",
      body: workspace.items
        .map((item, index) => `${index + 1}. ${item.title} (${formatMinutes(item.estimatedMinutes)})`)
        .join(" "),
    },
    {
      title: "Wrap-up",
      body:
        workspace.completionPrompts[0] ??
        "Use a quick exit check and capture the next step for tomorrow.",
    },
    {
      title: "Materials",
      body:
        materials.length > 0
          ? materials.join(" · ")
          : "Pull the materials already attached to the route item.",
    },
    {
      title: "Time box",
      body: `${formatMinutes(totalMinutes)} across ${workspace.items.length} route item${workspace.items.length === 1 ? "" : "s"}.`,
    },
  ];
}

export function TodayWorkspaceView({ workspace, sourceId }: TodayWorkspaceViewProps) {
  const [showLessonPlan, setShowLessonPlan] = useState(false);
  const lessonPlan = buildLessonPlanPreview(workspace);

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
      <Card className="border-border/70 bg-card/88">
        <CardContent className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{formatPlannerDate(workspace.date)}</Badge>
              <Badge variant="secondary">{workspace.learner.name}</Badge>
              <Badge variant="outline">{workspace.leadItem.sourceLabel}</Badge>
            </div>
            <div className="space-y-2">
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
              <Badge variant="secondary">
                {workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0)} minutes
              </Badge>
              <Badge variant="secondary">
                {workspace.sessionTargets.length} objective
                {workspace.sessionTargets.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowLessonPlan((value) => !value)}
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              {showLessonPlan ? "Hide lesson plan" : "Generate lesson plan"}
            </button>
            <Link
              href={`/curriculum${sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Review curriculum
            </Link>
          </div>
        </CardContent>
      </Card>

      {showLessonPlan ? (
        <Card className="border-border/70 bg-card/88">
          <CardHeader className="space-y-2">
            <CardDescription>Generated lesson plan</CardDescription>
            <CardTitle className="font-serif text-2xl">Built from today&apos;s objectives</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lessonPlan.map((section) => (
              <div key={section.title} className="rounded-3xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  {section.title}
                </p>
                <p className="mt-3 text-sm leading-7 text-foreground">{section.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

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
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" title={item.lessonLabel}>
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
                    <Link
                      href={`/today?date=${workspace.date}${sourceId ? `&sourceId=${sourceId}` : ""}&action=remove_today&planItemId=${item.id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Remove
                    </Link>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
