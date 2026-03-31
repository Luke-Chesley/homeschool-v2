import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  Clock3,
  Mountain,
  RefreshCcw,
  TimerReset,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { describeLoad, formatMinutes, formatPlannerDate } from "@/lib/planning/service";
import type { PlanDay } from "@/lib/planning/types";

interface DayPlanViewProps {
  day: PlanDay;
}

export function DayPlanView({ day }: DayPlanViewProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
      <div className="grid gap-6">
        <Card className="border-border/70 bg-card/88">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{formatPlannerDate(day.date)}</Badge>
              <Badge variant="outline">{describeLoad(day.bufferMinutes)}</Badge>
            </div>
            <CardTitle>{day.focus}</CardTitle>
            <CardDescription>{day.constraint.notes}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-border/70 bg-background/75 p-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Available time
              </p>
              <p className="mt-2 text-2xl font-semibold">{formatMinutes(day.availableMinutes)}</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/75 p-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Scheduled time
              </p>
              <p className="mt-2 text-2xl font-semibold">{formatMinutes(day.scheduledMinutes)}</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/75 p-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Hard stop
              </p>
              <p className="mt-2 text-2xl font-semibold">{day.constraint.hardStop}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/88">
          <CardHeader>
            <CardDescription>Lesson sequence</CardDescription>
            <CardTitle>Run order for the day</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {day.items.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-border/70 bg-background/75 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.subject}</Badge>
                  <Badge variant="outline">{item.status.replace("_", " ")}</Badge>
                  <Badge variant="outline">{item.sourceLabel}</Badge>
                  {item.curriculum ? (
                    <Badge variant="outline">weekly route: {item.curriculum.weeklyRouteItemId}</Badge>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-serif text-2xl">{item.title}</p>
                      {item.startTime ? (
                        <span className="rounded-full border border-border/70 px-3 py-1 text-sm font-semibold">
                          {item.startTime}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {item.objective}
                    </p>
                  </div>
                  <div className="rounded-full border border-border/70 px-3 py-2 text-sm font-semibold">
                    {formatMinutes(item.estimatedMinutes)}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
                    <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      Materials
                    </p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {item.materials.join(" · ")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
                    <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      Artifact hooks
                    </p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {item.artifactSlots.join(" · ")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
                    <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      Standards and goals
                    </p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {[...item.standards, ...item.goals].join(" · ")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 self-start">
        <Card className="border-primary/15 bg-background/88">
          <CardHeader>
            <CardDescription>Constraints</CardDescription>
            <CardTitle>What the planner is protecting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-card/75 p-4">
              <Clock3 className="mt-1 size-4 text-primary" />
              <div>
                <p className="font-semibold">Energy</p>
                <p className="text-sm leading-7 text-muted-foreground capitalize">
                  {day.constraint.energy}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-card/75 p-4">
              <Mountain className="mt-1 size-4 text-primary" />
              <div>
                <p className="font-semibold">Day flags</p>
                <p className="text-sm leading-7 text-muted-foreground">
                  {day.constraint.flags.join(" · ")}
                </p>
              </div>
            </div>
            {day.alerts.map((alert) => (
              <div
                key={alert}
                className="rounded-3xl border border-primary/15 bg-primary/8 p-4 text-sm leading-7 text-muted-foreground"
              >
                {alert}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/88">
          <CardHeader>
            <CardDescription>Route queue</CardDescription>
            <CardTitle>Select from weekly route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {day.selectableRouteItems.length === 0 ? (
              <div className="rounded-3xl border border-border/70 bg-background/75 p-4 text-sm leading-7 text-muted-foreground">
                No additional route items are waiting for this date.
              </div>
            ) : (
              day.selectableRouteItems.map((routeItem) => (
                <div
                  key={routeItem.id}
                  className="rounded-3xl border border-border/70 bg-background/75 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{routeItem.subject}</Badge>
                    <Badge variant="outline">position {routeItem.currentPosition}</Badge>
                    <Badge variant="outline">skill {routeItem.skillNodeId}</Badge>
                  </div>
                  <p className="mt-3 font-semibold">{routeItem.skillTitle}</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {routeItem.skillDescription}
                  </p>
                  <div className="mt-3">
                    <Link
                      href={`/planning/day/${day.date}?selectRouteItemId=${routeItem.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <CalendarPlus className="size-4" />
                      Add to day plan
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/88">
          <CardHeader>
            <CardDescription>Recovery options</CardDescription>
            <CardTitle>Deterministic adjustments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {day.recoveryOptions.map((option) => (
              <div
                key={option.id}
                className="rounded-3xl border border-border/70 bg-background/75 p-4"
              >
                <div className="flex items-start gap-3">
                  <RefreshCcw className="mt-1 size-4 text-primary" />
                  <div>
                    <p className="font-semibold">{option.title}</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {option.rationale}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {option.impact}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Link href="/today" className={buttonVariants({ variant: "default" })}>
            Open today workspace
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/planning" className={buttonVariants({ variant: "outline" })}>
            Back to week
          </Link>
          <Link href="/today" className={buttonVariants({ variant: "ghost" })}>
            <TimerReset className="size-4" />
            Hand off to execution
          </Link>
        </div>
      </div>
    </div>
  );
}
