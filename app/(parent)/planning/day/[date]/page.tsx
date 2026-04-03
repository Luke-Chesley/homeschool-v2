import { notFound, redirect } from "next/navigation";
import { CalendarClock, CalendarDays, LayoutDashboard, Sparkles } from "lucide-react";

import { DayPlanView } from "@/components/planning/day-plan-view";
import { PlanningShell } from "@/components/planning/planning-shell";
import { requireAppSession } from "@/lib/app-session/server";
import { listCurriculumSources } from "@/lib/curriculum/service";
import {
  getPlanningDayView,
  selectRouteItemForPlanningDay,
} from "@/lib/planning/service";

interface PlanningDayPageProps {
  params: Promise<{
    date: string;
  }>;
  searchParams: Promise<{
    selectRouteItemId?: string | string[];
    sourceId?: string | string[];
  }>;
}

export default async function PlanningDayPage({
  params,
  searchParams,
}: PlanningDayPageProps) {
  const session = await requireAppSession();
  const { date } = await params;
  const resolvedSearchParams = await searchParams;
  const selectedRouteItemId =
    typeof resolvedSearchParams.selectRouteItemId === "string"
      ? resolvedSearchParams.selectRouteItemId
      : undefined;
  const requestedSourceId =
    typeof resolvedSearchParams.sourceId === "string"
      ? resolvedSearchParams.sourceId
      : undefined;

  const sources = await listCurriculumSources(session.organization.id);
  const selectedSourceId =
    requestedSourceId && sources.some((source) => source.id === requestedSourceId)
      ? requestedSourceId
      : sources[0]?.id;

  if (selectedRouteItemId) {
    await selectRouteItemForPlanningDay({
      learnerId: session.activeLearner.id,
      date,
      weeklyRouteItemId: selectedRouteItemId,
    });
    const redirectSourceQuery = selectedSourceId
      ? `?sourceId=${encodeURIComponent(selectedSourceId)}`
      : "";
    redirect(`/planning/day/${date}${redirectSourceQuery}`);
  }

  const result = await getPlanningDayView({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    date,
    sourceId: selectedSourceId,
  });

  if (!result) {
    notFound();
  }

  const navItems = [
    {
      href: `/planning/month?sourceId=${result.sourceId}&month=${encodeURIComponent(date)}`,
      label: "Month planning",
      view: "month" as const,
      icon: CalendarDays,
    },
    {
      href: `/planning?sourceId=${result.sourceId}&weekStartDate=${encodeURIComponent(result.weekStartDate)}`,
      label: "Weekly planning",
      view: "week" as const,
      icon: CalendarClock,
    },
    {
      href: `/planning/day/${date}?sourceId=${encodeURIComponent(result.sourceId)}`,
      label: "Daily plan",
      view: "day" as const,
      icon: LayoutDashboard,
    },
    {
      href: `/today?date=${encodeURIComponent(date)}&sourceId=${encodeURIComponent(result.sourceId)}`,
      label: "Today workspace",
      view: "today" as const,
      icon: Sparkles,
    },
  ];

  return (
    <PlanningShell
      currentView="day"
      title="Daily plan"
      description={`${session.activeLearner.displayName} · ${result.sourceTitle}`}
      navItems={navItems}
    >
      <DayPlanView day={result.day} />
    </PlanningShell>
  );
}
