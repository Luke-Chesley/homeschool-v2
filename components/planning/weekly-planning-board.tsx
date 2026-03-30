import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  RefreshCcw,
  ShieldCheck,
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
import {
  describeLoad,
  formatMinutes,
  formatPlannerDate,
} from "@/lib/planning/service";
import type { WeeklyPlan, PlanDay } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

interface WeeklyPlanningBoardProps {
  week: WeeklyPlan;
}

const loadTone = {
  light: "border-secondary/30 bg-secondary/10 text-secondary-foreground",
  balanced: "border-primary/20 bg-primary/10 text-primary",
  packed: "border-destructive/20 bg-destructive/10 text-destructive",
};

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-border/70 bg-background/88">
      <CardHeader className="pb-3">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-7 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function DayCard({ day }: { day: PlanDay }) {
  return (
    <Card className="h-full border-border/70 bg-card/88">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardDescription>{formatPlannerDate(day.date)}</CardDescription>
            <CardTitle className="mt-1 text-2xl">{day.focus}</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={cn("tracking-[0.12em]", loadTone[day.load])}
          >
            {describeLoad(day.bufferMinutes)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/75 p-3">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Scheduled
            </p>
            <p className="mt-2 text-xl font-semibold">{formatMinutes(day.scheduledMinutes)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/75 p-3">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Available
            </p>
            <p className="mt-2 text-xl font-semibold">{formatMinutes(day.availableMinutes)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/75 p-3">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Buffer
            </p>
            <p className="mt-2 text-xl font-semibold">{formatMinutes(day.bufferMinutes)}</p>
          </div>
        </div>

        <div className="space-y-3">
          {day.items.map((item) => (
            <div
              key={item.id}
              className="rounded-3xl border border-border/70 bg-background/70 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.subject}</Badge>
                <Badge variant="outline">{item.kind}</Badge>
                <Badge variant="outline">{item.status.replace("_", " ")}</Badge>
              </div>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <p className="font-serif text-xl leading-tight">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {item.objective}
                  </p>
                </div>
                <div className="shrink-0 rounded-full border border-border/70 px-3 py-2 text-sm font-semibold">
                  {formatMinutes(item.estimatedMinutes)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/planning/day/${day.date}`}
            className={buttonVariants({ variant: "default" })}
          >
            Open day plan
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/today"
            className={buttonVariants({ variant: "outline" })}
          >
            See workspace
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function WeeklyPlanningBoard({ week }: WeeklyPlanningBoardProps) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Planned minutes"
          value={formatMinutes(week.summary.scheduledMinutes)}
          detail="Weekly total for dated work items before artifact generation or learner-mode activities."
        />
        <MetricCard
          title="Recovery margin"
          value={formatMinutes(week.summary.bufferMinutes)}
          detail="Remaining time across the week after scheduling, used for carryover and slower-than-expected lessons."
        />
        <MetricCard
          title="Carryover items"
          value={`${week.summary.carryoverCount}`}
          detail="Open tasks preserved with context rather than silently disappearing."
        />
        <MetricCard
          title="Recovery options"
          value={`${week.summary.recoveryCount}`}
          detail="Deterministic adjustments generated from constraints, load, and unfinished work."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="grid gap-6">
          {week.days.map((day) => (
            <DayCard key={day.date} day={day} />
          ))}
        </div>

        <div className="grid gap-6 self-start">
          <Card className="border-primary/15 bg-background/88">
            <CardHeader>
              <CardDescription>Week posture</CardDescription>
              <CardTitle>{week.weekLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-card/70 p-4">
                <CalendarDays className="mt-1 size-4 text-primary" />
                <div>
                  <p className="font-semibold">Pacing preference</p>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {week.learner.pacingPreference}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-card/70 p-4">
                <Clock3 className="mt-1 size-4 text-primary" />
                <div>
                  <p className="font-semibold">Current season</p>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {week.learner.currentSeason}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-card/70 p-4">
                <ShieldCheck className="mt-1 size-4 text-primary" />
                <div>
                  <p className="font-semibold">Standards in play</p>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {week.standardsFocus.join(" · ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/88">
            <CardHeader>
              <CardDescription>Recovery logic</CardDescription>
              <CardTitle>How the planner decides what to adjust</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-background/75 p-4">
                <RefreshCcw className="mt-1 size-4 text-primary" />
                <p className="text-sm leading-7 text-muted-foreground">
                  Appointment days prefer rescheduling heavy practice to open blocks.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-background/75 p-4">
                <RefreshCcw className="mt-1 size-4 text-primary" />
                <p className="text-sm leading-7 text-muted-foreground">
                  Carryover stays visible until it lands on a real day with enough context to finish cleanly.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-background/75 p-4">
                <RefreshCcw className="mt-1 size-4 text-primary" />
                <p className="text-sm leading-7 text-muted-foreground">
                  Spare buffer is used to slow down hard lessons before the system suggests filling more time.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
