import Link from "next/link";

import { MonthPlanningBoard } from "@/components/planning/month-planning-board";
import { PlanningShell } from "@/components/planning/planning-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { getLiveCurriculumSource } from "@/lib/curriculum/service";
import { getMonthlyPlanningView } from "@/lib/planning/month-service";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlanningMonthPageProps {
  searchParams: Promise<{ month?: string }>;
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

  const monthAnchorDate = params.month ?? new Date().toISOString().slice(0, 10);

  const month = await getMonthlyPlanningView({
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    sourceId: liveSource.id,
    sourceTitle: liveSource.title,
    monthDate: monthAnchorDate,
  });

  return (
    <PlanningShell>
      <div className="grid gap-6">
        <Card>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Live curriculum
              </p>
              <p className="font-medium text-foreground">{liveSource.title}</p>
            </div>
            <Link href="/curriculum" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Change on curriculum
            </Link>
          </div>
        </Card>
        <MonthPlanningBoard month={month} />
      </div>
    </PlanningShell>
  );
}
