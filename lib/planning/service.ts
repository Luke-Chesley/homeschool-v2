import "@/lib/server-only";

import { eq } from "drizzle-orm";

import { getLiveCurriculumSource } from "@/lib/curriculum/service";
import { toWeekStartDate } from "@/lib/curriculum-routing";
import { getDb } from "@/lib/db/server";
import { weeklyRouteItems } from "@/lib/db/schema";
import { getTodayWorkspace } from "@/lib/planning/today-service";
import { moveWeeklyRouteItem } from "@/lib/planning/weekly-route-service";
import type {
  DayLoad,
  PlanDay,
  PlanItem,
  RecoveryOption,
  ScheduleConstraint,
  WeeklyRouteItem,
} from "@/lib/planning/types";

function guessEnergyLevel(scheduledMinutes: number): ScheduleConstraint["energy"] {
  if (scheduledMinutes >= 180) {
    return "high";
  }

  if (scheduledMinutes >= 120) {
    return "steady";
  }

  return "low";
}

function buildConstraint(date: string, scheduledMinutes: number, sourceTitle: string): ScheduleConstraint {
  const energy = guessEnergyLevel(scheduledMinutes);
  const hardStop = scheduledMinutes >= 180 ? "3:30 PM" : scheduledMinutes >= 120 ? "2:30 PM" : "1:30 PM";

  return {
    date,
    availableMinutes: Math.max(scheduledMinutes + 45, 150),
    hardStop,
    energy,
    notes: `${sourceTitle} is scheduled for a ${energy} workload day.`,
    flags: [
      "session workspace synced",
      scheduledMinutes >= 180 ? "dense day" : "recovery margin available",
    ],
  };
}

function deriveLoad(constraint: ScheduleConstraint, scheduledMinutes: number): DayLoad {
  const bufferMinutes = constraint.availableMinutes - scheduledMinutes;
  if (bufferMinutes >= 45) {
    return "light";
  }
  if (bufferMinutes >= 15) {
    return "balanced";
  }
  return "packed";
}

function collectSelectableRouteItems(
  alternatesByPlanItemId: Record<string, WeeklyRouteItem[]>,
): WeeklyRouteItem[] {
  const items = new Map<string, WeeklyRouteItem>();

  for (const alternates of Object.values(alternatesByPlanItemId)) {
    for (const item of alternates) {
      if (!items.has(item.id)) {
        items.set(item.id, item);
      }
    }
  }

  return [...items.values()];
}

function buildRecoveryOptions(day: {
  date: string;
  items: PlanItem[];
  selectableRouteItems: WeeklyRouteItem[];
}): RecoveryOption[] {
  const options: RecoveryOption[] = [];

  const reviewItems = day.items.filter((item) => item.reviewState === "awaiting_review");
  if (reviewItems.length > 0) {
    options.push({
      id: "review-queue",
      title: "Route review before advancing",
      rationale: `${reviewItems.length} item${reviewItems.length === 1 ? "" : "s"} need review before the sequence should move on.`,
      impact: "Keeps evidence and approval aligned with what gets scheduled next.",
      actionLabel: "Open review queue",
      action: {
        type: "recover",
        itemIds: reviewItems.map((item) => item.id),
      },
    });
  }

  if (day.selectableRouteItems.length > 0) {
    options.push({
      id: "swap-from-route",
      title: "Swap in a queued route item",
      rationale: "The weekly route still has alternates that can fill the day without losing sequence context.",
      impact: "Lets the day adapt without dropping the broader route state on the floor.",
      actionLabel: "Use alternate",
      action: {
        type: "recover",
        itemIds: day.selectableRouteItems.slice(0, 1).map((item) => item.id),
      },
    });
  }

  return options;
}

export async function getPlanningDayView(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}): Promise<{
  day: PlanDay;
  sourceId: string;
  sourceTitle: string;
  weekStartDate: string;
} | null> {
  const source = await getLiveCurriculumSource(params.organizationId);

  if (!source) {
    return null;
  }

  const workspaceResult = await getTodayWorkspace({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    learnerName: params.learnerName,
    date: params.date,
  });

  if (!workspaceResult) {
    return null;
  }

  const scheduledMinutes = workspaceResult.workspace.items.reduce(
    (sum, item) => sum + item.estimatedMinutes,
    0,
  );
  const constraint = buildConstraint(params.date, scheduledMinutes, source.title);
  const selectableRouteItems = collectSelectableRouteItems(
    workspaceResult.workspace.alternatesByPlanItemId,
  );

  const day: PlanDay = {
    date: params.date,
    label: formatPlannerDate(params.date),
    focus:
      workspaceResult.workspace.leadItem?.title ??
      `${source.title} session workspace`,
    availableMinutes: constraint.availableMinutes,
    scheduledMinutes,
    bufferMinutes: Math.max(0, constraint.availableMinutes - scheduledMinutes),
    load: deriveLoad(constraint, scheduledMinutes),
    constraint,
    items: workspaceResult.workspace.items,
    selectableRouteItems,
    carryoverItems: workspaceResult.workspace.items.filter(
      (item) => item.completionStatus === "needs_follow_up" || item.status === "carried_over",
    ),
    recoveryOptions: [],
    alerts: workspaceResult.workspace.items.flatMap((item) => {
      const alerts: string[] = [];
      if (item.reviewState === "awaiting_review") {
        alerts.push(`${item.title} is waiting for review before the route advances.`);
      }
      if (item.completionStatus === "needs_follow_up") {
        alerts.push(`${item.title} needs follow-up before it should be treated as complete.`);
      }
      return alerts;
    }),
  };

  day.recoveryOptions = buildRecoveryOptions({
    date: params.date,
    items: day.items,
    selectableRouteItems: day.selectableRouteItems,
  });

  return {
    day,
    sourceId: source.id,
    sourceTitle: source.title,
    weekStartDate: toWeekStartDate(params.date),
  };
}

export async function selectRouteItemForPlanningDay(params: {
  learnerId: string;
  weeklyRouteItemId: string;
  date: string;
}) {
  const routeItem = await getDb().query.weeklyRouteItems.findFirst({
    where: eq(weeklyRouteItems.id, params.weeklyRouteItemId),
  });

  if (!routeItem) {
    throw new Error(`Weekly route item not found: ${params.weeklyRouteItemId}`);
  }

  await moveWeeklyRouteItem({
    learnerId: params.learnerId,
    weeklyRouteId: routeItem.weeklyRouteId,
    weeklyRouteItemId: routeItem.id,
    targetScheduledDate: params.date,
    targetIndex: 999,
    manualOverrideNote: `Added to ${params.date} from planning day view.`,
  });
}

export function formatPlannerDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatMinutes(minutes: number) {
  return `${minutes} min`;
}

export function describeLoad(bufferMinutes: number) {
  if (bufferMinutes >= 45) {
    return "Light day";
  }

  if (bufferMinutes >= 15) {
    return "Balanced day";
  }

  return "Packed day";
}

export function getPlanningWeekStartDate(date: string) {
  return toWeekStartDate(date);
}
