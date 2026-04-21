import Link from "next/link";
import { ArrowRight, CalendarRange } from "lucide-react";

import { PlanningShell } from "@/components/planning/planning-shell";
import { WeeklyRouteBoard } from "@/components/planning/weekly-route-board";
import { Button } from "@/components/ui/button";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { requireAppSession } from "@/lib/app-session/server";
import { getLiveCurriculumSource } from "@/lib/curriculum/service";
import { buildHomeschoolPlannerSummary } from "@/lib/homeschool/planner";
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

function formatWeekRange(weekStartDate: string) {
  const start = new Date(`${weekStartDate}T12:00:00.000Z`);
  const end = new Date(`${weekStartDate}T12:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 6);

  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  }).format(end);

  return `${startLabel} - ${endLabel}`;
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
        <EmptyStatePanel
          title="Planning starts with one live source."
          body="Set a curriculum source live first so the week board can place real skills instead of empty columns."
          icon={CalendarRange}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Link href="/curriculum" className="quiet-panel-muted p-4 text-left transition-colors hover:bg-card/80">
              <p className="text-sm font-semibold text-foreground">Choose a source</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Make one curriculum source live for planning and Today.
              </p>
            </Link>
            <div className="quiet-panel-muted p-4 text-left">
              <p className="text-sm font-semibold text-foreground">Build the week lightly</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start with a realistic target, then drag only what belongs this week.
              </p>
            </div>
            <div className="quiet-panel-muted p-4 text-left">
              <p className="text-sm font-semibold text-foreground">Let overflow stay flexible</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Backlog items can wait until the week can actually absorb them.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Button asChild>
              <Link href="/curriculum">
                Open curriculum
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </EmptyStatePanel>
      </PlanningShell>
    );
  }

  const { weekStartDate, board } = await getOrCreateWeeklyRouteBoardForLearner({
    learnerId: session.activeLearner.id,
    sourceId: liveSource.id,
    weekStartDate: params.weekStartDate,
  });
  const plannerSummary = buildHomeschoolPlannerSummary(board);
  const weekViewHref = `/planning${params.weekStartDate ? `?weekStartDate=${encodeURIComponent(params.weekStartDate)}` : ""}`;
  const focusDate =
    parseDateValue(params.focusDate) ??
    parseDateValue(params.day) ??
    getWeekDate(weekStartDate, 3);
  const monthViewHref = `/planning/month?month=${encodeURIComponent(focusDate)}`;
  const previousWeekHref = `/planning?weekStartDate=${encodeURIComponent(getWeekDate(weekStartDate, -7))}`;
  const nextWeekHref = `/planning?weekStartDate=${encodeURIComponent(getWeekDate(weekStartDate, 7))}`;

  return (
    <PlanningShell>
      <header className="page-header">
        <p className="section-meta">Planning</p>
        <div className="space-y-3">
          <h1 className="page-title">Build a week you can actually run.</h1>
          <p className="page-subtitle">{plannerSummary.guidance}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={weekViewHref} className={buttonVariants({ variant: "default", size: "sm" })}>
            Week view
          </Link>
          <Link href={monthViewHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-w-fit")}>
            Month view
          </Link>
          <Link href="/curriculum" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Change curriculum
          </Link>
          <span className="text-sm text-muted-foreground">{liveSource.title}</span>
        </div>
      </header>

      <div className="grid gap-4">
        <WeeklyRouteBoard
          initialBoard={board}
          weekStartDate={weekStartDate}
          navigation={{
            previousHref: previousWeekHref,
            nextHref: nextWeekHref,
            rangeLabel: formatWeekRange(weekStartDate),
          }}
        />
      </div>
    </PlanningShell>
  );
}
