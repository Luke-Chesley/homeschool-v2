import Link from "next/link";

import { PlanningShell } from "@/components/planning/planning-shell";
import { MonthPlanningBoard } from "@/components/planning/month-planning-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { getLiveCurriculumSource } from "@/lib/curriculum/service";
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

interface PlanningMonthPageProps {
  searchParams: Promise<PlanningMonthSearchParams>;
}

export default async function PlanningMonthPage({ searchParams }: PlanningMonthPageProps) {
  const session = await requireAppSession();
  const params = await searchParams;
  const liveSource = await getLiveCurriculumSource(session.organization.id);

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
    new Date().toISOString().slice(0, 10);

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

  return (
    <PlanningShell>
      <header className="page-header">
        <p className="section-meta">Live curriculum · {liveSource.title}</p>
        <h1 className="page-title">Plan the whole month from one screen.</h1>
        <p className="page-subtitle">
          Month view keeps the bigger picture visible while you still schedule by day.
        </p>
        <div className="toolbar-row">
          <div className="flex flex-wrap gap-2">
            <Link href={weekViewHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Week view
            </Link>
            <Link href={monthViewHref} className={cn(buttonVariants({ variant: "default", size: "sm" }), "min-w-fit")}>
              Month view
            </Link>
          </div>
          <Link href="/curriculum" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Change curriculum
          </Link>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="quiet-panel">
          <div className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Scheduled</p>
            <p className="text-2xl font-semibold text-foreground">{month.summary.scheduledCount}</p>
          </div>
        </Card>
        <Card className="quiet-panel">
          <div className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Unscheduled</p>
            <p className="text-2xl font-semibold text-foreground">{month.summary.unassignedCount}</p>
          </div>
        </Card>
        <Card className="quiet-panel">
          <div className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Conflicts</p>
            <p className="text-2xl font-semibold text-foreground">{month.summary.conflictCount}</p>
          </div>
        </Card>
        <Card className="quiet-panel">
          <div className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Month view</p>
            <p className="text-2xl font-semibold text-foreground">{month.summary.daysInMonth} days</p>
          </div>
        </Card>
      </section>

      <div className="grid gap-4">
        <MonthPlanningBoard month={month} />
      </div>
    </PlanningShell>
  );
}
