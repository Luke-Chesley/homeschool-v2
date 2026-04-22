import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { PlanningShell } from "@/components/planning/planning-shell";
import { MonthPlanningBoard } from "@/components/planning/month-planning-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { getLiveCurriculumSource } from "@/lib/curriculum/service";
import { getDateInTimezone } from "@/lib/date";
import { getMonthlyPlanningView } from "@/lib/planning/month-service";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlanningMonthSearchParams {
  month?: string;
  focusDate?: string;
  day?: string;
}

function parseDateValue(value?: string) {
  if (!value) {
    return null;
  }

  const normalized = value.includes("T") ? value : `${value}T12:00:00.000Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function shiftMonth(date: string, offset: number) {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCMonth(parsed.getUTCMonth() + offset, 1);
  return parsed.toISOString().slice(0, 10);
}

interface PlanningMonthPageProps {
  searchParams: Promise<PlanningMonthSearchParams>;
}

export default async function PlanningMonthPage({ searchParams }: PlanningMonthPageProps) {
  const session = await requireAppSession();
  const params = await searchParams;
  const liveSource = await getLiveCurriculumSource(session.organization.id);
  const localToday = getDateInTimezone(session.organization.timezone);

  if (!liveSource) {
    return (
      <PlanningShell>
        <Card>
          <CardHeader>
            <CardTitle>No curriculum source available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add a curriculum source first so the month view can place real route items.
            </p>
            <Button asChild>
              <Link href="/curriculum">Open curriculum</Link>
            </Button>
          </CardContent>
        </Card>
      </PlanningShell>
    );
  }

  const monthAnchorDate =
    parseDateValue(params.month) ??
    parseDateValue(params.focusDate) ??
    parseDateValue(params.day) ??
    localToday;

  const month = await getMonthlyPlanningView({
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    sourceId: liveSource.id,
    sourceTitle: liveSource.title,
    monthDate: monthAnchorDate,
  });
  const firstWeekStartDate = month.weeks[0]?.weekStartDate;
  const weekViewHref = `/planning${firstWeekStartDate ? `?weekStartDate=${encodeURIComponent(firstWeekStartDate)}` : ""}`;
  const monthViewHref = `/planning/month?month=${encodeURIComponent(monthAnchorDate)}`;
  const previousMonthHref = `/planning/month?month=${encodeURIComponent(shiftMonth(monthAnchorDate, -1))}`;
  const nextMonthHref = `/planning/month?month=${encodeURIComponent(shiftMonth(monthAnchorDate, 1))}`;

  return (
    <PlanningShell>
      <header className="page-header">
        <p className="section-meta">Live curriculum · {liveSource.title}</p>
        <h1 className="page-title">Plan the whole month from one screen.</h1>
        <p className="page-subtitle">
          Month view keeps the bigger picture visible while you still schedule by day.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={previousMonthHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="size-4" />
            Previous month
          </Link>
          <div className="rounded-full border border-border/70 bg-background/72 px-3 py-1.5 text-sm text-foreground">
            {month.monthLabel}
          </div>
          <Link href={nextMonthHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Next month
            <ArrowRight className="size-4" />
          </Link>
          <Link href={weekViewHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Week view
          </Link>
          <Link href={monthViewHref} className={cn(buttonVariants({ variant: "default", size: "sm" }), "min-w-fit")}>
            Month view
          </Link>
          <Link href="/curriculum" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Change curriculum
          </Link>
        </div>
      </header>

      <div className="grid gap-4">
        <MonthPlanningBoard month={month} />
      </div>
    </PlanningShell>
  );
}
