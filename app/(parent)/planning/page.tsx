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
      <div className="grid gap-4">
        <Card>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Live curriculum
              </p>
              <p className="font-medium text-foreground">{liveSource.title}</p>
            </div>
            <Link href="/curriculum" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Change curriculum
            </Link>
          </div>
        </Card>
        <Card>
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Weekly planning
              </p>
              <h2 className="font-serif text-2xl text-foreground">Build a week you can actually run.</h2>
              <p className="text-sm leading-6 text-muted-foreground">{plannerSummary.guidance}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl bg-background/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scheduled</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{plannerSummary.scheduledCount}</p>
              </div>
              <div className="rounded-2xl bg-background/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Unscheduled</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{plannerSummary.unscheduledCount}</p>
              </div>
              <div className="rounded-2xl bg-background/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Done already</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{plannerSummary.doneCount}</p>
              </div>
              <div className="rounded-2xl bg-background/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Planner policy</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {plannerPolicy.maxItemsPerDay} items/day target
                </p>
              </div>
            </div>
          </div>
        </Card>
        <WeeklyRouteBoard initialBoard={board} weekStartDate={weekStartDate} />
      </div>
    </PlanningShell>
  );
}
