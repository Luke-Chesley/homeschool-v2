import Link from "next/link";
import { ArrowRight, CalendarDays, Grid3X3, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyPlan, MonthlyPlanWeek } from "@/lib/planning/types";
import type { WeeklyRouteBoardItem } from "@/lib/curriculum-routing/types";
import { cn } from "@/lib/utils";

interface MonthPlanningBoardProps {
  month: MonthlyPlan;
}

function formatMinutes(minutes: number | null | undefined) {
  return `${minutes ?? 0} min`;
}

function ItemPill({ item }: { item: WeeklyRouteBoardItem }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px] tracking-[0.14em]">
          {item.state.replace("_", " ")}
        </Badge>
        {item.manualOverrideKind !== "none" ? (
          <Badge variant="outline" className="text-[10px] tracking-[0.14em]">
            {item.manualOverrideKind.replace("_", " ")}
          </Badge>
        ) : null}
        <Badge variant="outline" className="ml-auto text-[10px] tracking-[0.14em]">
          {formatMinutes(item.estimatedMinutes)}
        </Badge>
      </div>
      <p className="mt-2 text-sm font-medium leading-6">{item.skillTitle}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.skillPath}</p>
    </div>
  );
}

function WeekCard({ week, sourceId }: { week: MonthlyPlanWeek; sourceId: string }) {
  return (
    <Card className="border-border/70 bg-card/88">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardDescription>Weekly placement</CardDescription>
            <CardTitle className="mt-1 text-2xl">{week.weekLabel}</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{week.scheduledCount} placed</Badge>
            {week.unassignedItems.length > 0 ? (
              <Badge variant="secondary">{week.unassignedItems.length} unassigned</Badge>
            ) : null}
            {week.conflictCount > 0 ? (
              <Badge variant="outline" className="text-destructive">
                {week.conflictCount} conflicts
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-5">
          {week.days.map((day) => (
            <div key={day.date} className="rounded-3xl border border-border/70 bg-background/75 p-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  {day.label}
                </p>
                <p className="text-xs text-muted-foreground">{formatMinutes(day.scheduledMinutes)}</p>
              </div>
              <div className="mt-3 space-y-2">
                {day.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-xs leading-6 text-muted-foreground">
                    No placements yet
                  </div>
                ) : (
                  day.items.map((item) => <ItemPill key={item.id} item={item} />)
                )}
              </div>
            </div>
          ))}
        </div>

        {week.unassignedItems.length > 0 ? (
          <div className="rounded-3xl border border-primary/15 bg-primary/8 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Layers3 className="size-4 text-primary" />
              <p className="font-semibold">Unassigned starting points</p>
              <Badge variant="outline" className="ml-auto">
                {week.unassignedItems.length} items
              </Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {week.unassignedItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/70 bg-background/75 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] tracking-[0.14em]">
                      {item.state.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] tracking-[0.14em]">
                      current route
                    </Badge>
                    <Badge variant="outline" className="ml-auto text-[10px] tracking-[0.14em]">
                      {formatMinutes(item.estimatedMinutes)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-6">{item.skillTitle}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.skillPath}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/planning?sourceId=${sourceId}&weekStartDate=${week.weekStartDate}`}
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            Open week
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function MonthPlanningBoard({ month }: MonthPlanningBoardProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70 bg-background/88">
            <CardHeader className="pb-3">
              <CardDescription>Scheduled time</CardDescription>
              <CardTitle className="text-3xl">{formatMinutes(month.summary.scheduledMinutes)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-muted-foreground">
                A broad placement draft for {month.learner.name}. Use the week cards to tighten the order.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-background/88">
            <CardHeader className="pb-3">
              <CardDescription>Placed curriculum</CardDescription>
              <CardTitle className="text-3xl">{month.summary.scheduledCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-muted-foreground">
                Items already anchored to a day in the current month view.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-background/88">
            <CardHeader className="pb-3">
              <CardDescription>Unassigned items</CardDescription>
              <CardTitle className="text-3xl">{month.summary.unassignedCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-muted-foreground">
                Items still waiting for a week or day placement.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-background/88">
            <CardHeader className="pb-3">
              <CardDescription>Conflicts</CardDescription>
              <CardTitle className="text-3xl">{month.summary.conflictCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-muted-foreground">
                Planning warnings carried through from the weekly route boards.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6">
          {month.weeks.map((week) => (
            <WeekCard key={week.weekStartDate} week={week} sourceId={month.sourceId} />
          ))}
        </section>
      </div>

      <div className="grid gap-6 self-start">
        <Card className="border-primary/15 bg-background/88">
          <CardHeader>
            <CardDescription>Month posture</CardDescription>
            <CardTitle>Start broad, then narrow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-card/75 p-4">
              <CalendarDays className="mt-1 size-4 text-primary" />
              <div>
                <p className="font-semibold">Source</p>
                <p className="text-sm leading-7 text-muted-foreground">{month.sourceTitle}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-card/75 p-4">
              <Grid3X3 className="mt-1 size-4 text-primary" />
              <div>
                <p className="font-semibold">Weeks in view</p>
                <p className="text-sm leading-7 text-muted-foreground">
                  {month.summary.weeksInView} week{month.summary.weeksInView === 1 ? "" : "s"} of placement
                  around the chosen month.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/88">
          <CardHeader>
            <CardDescription>What to do next</CardDescription>
            <CardTitle>Use the month as the draft</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-7 text-muted-foreground">
              Open a week, move curriculum into the right day, and let the daily view handle the
              execution detail once the placement looks right.
            </p>
            <Link
              href={`/planning?sourceId=${month.sourceId}&weekStartDate=${month.weeks[0]?.weekStartDate ?? month.monthStartDate}`}
              className={cn(buttonVariants({ variant: "default" }), "w-full")}
            >
              Open the first week in this month
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
