import Link from "next/link";

import { CurriculumSourceSelector } from "@/components/curriculum/curriculum-source-selector";
import { MonthPlanningBoard } from "@/components/planning/month-planning-board";
import { PlanningShell } from "@/components/planning/planning-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { listCurriculumSources } from "@/lib/curriculum/service";
import { getMonthlyPlanningView } from "@/lib/planning/month-service";

interface PlanningMonthPageProps {
  searchParams: Promise<{ sourceId?: string; month?: string }>;
}

export default async function PlanningMonthPage({ searchParams }: PlanningMonthPageProps) {
  const session = await requireAppSession();
  const params = await searchParams;
  const sources = await listCurriculumSources(session.organization.id);

  if (sources.length === 0) {
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

  const selectedSourceId =
    params.sourceId && sources.some((source) => source.id === params.sourceId)
      ? params.sourceId
      : sources[0].id;
  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? sources[0];
  const monthAnchorDate = params.month ?? new Date().toISOString().slice(0, 10);

  const month = await getMonthlyPlanningView({
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    sourceId: selectedSourceId,
    sourceTitle: selectedSource.title,
    monthDate: monthAnchorDate,
  });

  return (
    <PlanningShell>
      <div className="grid gap-6">
        <CurriculumSourceSelector
          sources={sources}
          selectedSourceId={selectedSourceId}
          basePath="/planning/month"
          month={month.monthStartDate}
        />
        <MonthPlanningBoard month={month} />
      </div>
    </PlanningShell>
  );
}
