import Link from "next/link";

import { PlanningShell } from "@/components/planning/planning-shell";
import { WeeklyRouteBoard } from "@/components/planning/weekly-route-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { getLiveCurriculumSource } from "@/lib/curriculum/service";
import { buildHomeschoolPlannerSummary, getHomeschoolPlannerPolicy } from "@/lib/homeschool/planner";
import { getOrCreateWeeklyRouteBoardForLearner } from "@/lib/planning/weekly-route-service";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlanningPageSearchParams {
  weekStartDate?: string;
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

function getWeekDate(weekStartDate: string, offset: number) {
  const parsed = new Date(`${weekStartDate}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + offset);
  return parsed.toISOString().slice(0, 10);
}

interface PlanningPageProps {
  searchParams: Promise<PlanningPageSearchParams>;
}

export default async function PlanningPage({ searchParams }: PlanningPageProps) {
  const [session, params] = await Promise.all([requireAppSession(), searchParams]);
  const liveSource = await getLiveCurriculumSource(session.organization.id);

  if (!liveSource) {
    return (
      <PlanningShell>
        <Card>
          <CardHeader>
            <CardTitle>No curriculum source</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add a source before building the week.
            </p>
            <Button asChild className="mt-4">
              <Link href="/curriculum">Open curriculum</Link>
            </Button>
          </CardContent>
        </Card>
      </PlanningShell>
    );
  }

  const { weekStartDate, board } = await getOrCreateWeeklyRouteBoardForLearner({
    learnerId: session.activeLearner.id,
    sourceId: liveSource.id,
    weekStartDate: params.weekStartDate,
  });
  const plannerPolicy = getHomeschoolPlannerPolicy();
  const plannerSummary = buildHomeschoolPlannerSummary(board);
  const weekViewHref = `/planning${params.weekStartDate ? `?weekStartDate=${encodeURIComponent(params.weekStartDate)}` : ""}`;
  const focusDate =
    parseDateValue(params.focusDate) ??
    parseDateValue(params.day) ??
    getWeekDate(weekStartDate, 3);
  const monthViewHref = `/planning/month?month=${encodeURIComponent(focusDate)}`;

  return (
    <PlanningShell>
      <header className="page-header">
        <p className="section-meta">Live curriculum · {liveSource.title}</p>
        <h1 className="page-title">Build a week you can actually run.</h1>
        <p className="page-subtitle">{plannerSummary.guidance}</p>
        <div className="toolbar-row">
          <div className="flex flex-wrap gap-2">
            <Link href={weekViewHref} className={buttonVariants({ variant: "default", size: "sm" })}>
              Week view
            </Link>
            <Link href={monthViewHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-w-fit")}>
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
            <p className="text-2xl font-semibold text-foreground">{plannerSummary.scheduledCount}</p>
          </div>
        </Card>
        <Card className="quiet-panel">
          <div className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Unscheduled</p>
            <p className="text-2xl font-semibold text-foreground">{plannerSummary.unscheduledCount}</p>
          </div>
        </Card>
        <Card className="quiet-panel">
          <div className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Done already</p>
            <p className="text-2xl font-semibold text-foreground">{plannerSummary.doneCount}</p>
          </div>
        </Card>
        <Card className="quiet-panel">
          <div className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Planner policy</p>
            <p className="text-base font-semibold text-foreground">
              {plannerPolicy.maxItemsPerDay} items/day target
            </p>
          </div>
        </Card>
      </section>

      <div className="grid gap-4">
        <WeeklyRouteBoard initialBoard={board} weekStartDate={weekStartDate} />
      </div>
    </PlanningShell>
  );
}
