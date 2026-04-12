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

interface PlanningPageProps {
  searchParams: Promise<{ weekStartDate?: string }>;
}

export default async function PlanningPage({ searchParams }: PlanningPageProps) {
  const session = await requireAppSession();
  const params = await searchParams;
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

  return (
    <PlanningShell>
      <header className="page-header">
        <p className="section-meta">Live curriculum · {liveSource.title}</p>
        <h1 className="page-title">Build a week you can actually run.</h1>
        <p className="page-subtitle">{plannerSummary.guidance}</p>
        <div className="toolbar-row">
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
