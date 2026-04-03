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
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-border/70 pb-4">
          <h1 className="font-serif text-3xl leading-tight tracking-tight">Planning</h1>
        </header>
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
      title="Planning"
      description={session.activeLearner.displayName}
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
