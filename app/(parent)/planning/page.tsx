import Link from "next/link";
import { CalendarClock, CalendarDays, LayoutDashboard, Sparkles } from "lucide-react";

import { CurriculumSourceSelector } from "@/components/curriculum/curriculum-source-selector";
import { WeeklyRouteBoard } from "@/components/planning/weekly-route-board";
import { PlanningShell } from "@/components/planning/planning-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { listCurriculumSources } from "@/lib/curriculum/service";
import { getOrCreateWeeklyRouteBoardForLearner } from "@/lib/planning/weekly-route-service";

interface PlanningPageProps {
  searchParams: Promise<{ sourceId?: string; weekStartDate?: string }>;
}

export default async function PlanningPage({ searchParams }: PlanningPageProps) {
  const session = await requireAppSession();
  const params = await searchParams;
  const sources = await listCurriculumSources(session.organization.id);

  if (sources.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 sm:px-8 lg:px-10">
        <header>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">Planning</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Weekly routing needs at least one imported curriculum source.
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">No curriculum source available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Go to curriculum and import the local sample before planning this week.
            </p>
            <Button asChild className="mt-4">
              <Link href="/curriculum">Open curriculum</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const selectedSourceId =
    params.sourceId && sources.some((source) => source.id === params.sourceId)
      ? params.sourceId
      : sources[0].id;

  const { weekStartDate, board } = await getOrCreateWeeklyRouteBoardForLearner({
    learnerId: session.activeLearner.id,
    sourceId: selectedSourceId,
    weekStartDate: params.weekStartDate,
  });

  const navItems = [
    {
      href: `/planning/month?sourceId=${selectedSourceId}&month=${encodeURIComponent(weekStartDate)}`,
      label: "Month planning",
      view: "month" as const,
      icon: CalendarDays,
    },
    {
      href: `/planning?sourceId=${selectedSourceId}&weekStartDate=${encodeURIComponent(weekStartDate)}`,
      label: "Weekly planning",
      view: "week" as const,
      icon: CalendarClock,
    },
    {
      href: `/planning/day/${weekStartDate}`,
      label: "Daily plan",
      view: "day" as const,
      icon: LayoutDashboard,
    },
    {
      href: `/today?sourceId=${selectedSourceId}`,
      label: "Today workspace",
      view: "today" as const,
      icon: Sparkles,
    },
  ];

  return (
    <PlanningShell
      currentView="week"
      title={`Weekly planning for ${session.activeLearner.displayName}`}
      description="Weekly route board for the active learner. Drag items to reorder or assign days."
      navItems={navItems}
    >
      <div className="grid gap-6 2xl:grid-cols-[320px_minmax(0,1fr)]">
        <CurriculumSourceSelector
          sources={sources}
          selectedSourceId={selectedSourceId}
          basePath="/planning"
          weekStartDate={weekStartDate}
        />
        <WeeklyRouteBoard initialBoard={board} weekStartDate={weekStartDate} />
      </div>
    </PlanningShell>
  );
}
