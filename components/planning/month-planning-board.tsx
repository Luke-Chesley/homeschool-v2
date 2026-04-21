"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ArrowRight, CalendarDays, ChevronDown, GripVertical, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { UpdateCurriculumScheduleButton } from "@/components/planning/update-curriculum-schedule-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyPlan, MonthlyPlanDay, MonthlyPlanWeek } from "@/lib/planning/types";
import type { WeeklyRouteBoardItem } from "@/lib/curriculum-routing/types";
import { cn } from "@/lib/utils";

type ColumnId = string;
type ColumnsState = Record<ColumnId, string[]>;

interface MonthPlanningBoardProps {
  month: MonthlyPlan;
}

interface ColumnMeta {
  id: ColumnId;
  weeklyRouteId: string;
  scheduledDate: string | null;
  label: string;
}

function formatMinutes(minutes: number | null | undefined) {
  return `${minutes ?? 0} min`;
}

function getStateLabel(state: WeeklyRouteBoardItem["state"]) {
  if (state === "queued") return "Backlog";
  if (state === "scheduled") return "Planned";
  if (state === "in_progress") return "Working";
  if (state === "done") return "Done";
  return "Paused";
}

function getSkillContextLabel(item: WeeklyRouteBoardItem) {
  return item.skillPath.split(/[·/]/)[0]?.trim() || item.skillPath;
}

function createColumns(month: MonthlyPlan): ColumnsState {
  const columns: ColumnsState = {};

  for (const week of month.weeks) {
    columns[`unassigned:${week.weeklyRouteId}`] = week.unassignedItems.map((item) => item.id);

    for (const day of week.days) {
      if (day.isDroppable) {
        columns[day.date] = day.items.map((item) => item.id);
      }
    }
  }

  return columns;
}

function createColumnMeta(month: MonthlyPlan) {
  const meta = new Map<ColumnId, ColumnMeta>();

  for (const week of month.weeks) {
    meta.set(`unassigned:${week.weeklyRouteId}`, {
      id: `unassigned:${week.weeklyRouteId}`,
      weeklyRouteId: week.weeklyRouteId,
      scheduledDate: null,
      label: `${week.weekLabel} backlog`,
    });

    for (const day of week.days) {
      if (!day.isDroppable) {
        continue;
      }

      meta.set(day.date, {
        id: day.date,
        weeklyRouteId: day.weeklyRouteId,
        scheduledDate: day.date,
        label: day.label,
      });
    }
  }

  return meta;
}

function findColumnForId(id: string, columns: ColumnsState) {
  if (Object.hasOwn(columns, id)) {
    return id;
  }

  return Object.keys(columns).find((columnId) => columns[columnId].includes(id));
}

function SortableMonthItem({
  item,
  isSaving,
}: {
  item: WeeklyRouteBoardItem;
  isSaving: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "relative rounded-xl border border-border/75 bg-card/95 px-2.5 py-2.5 shadow-sm",
        expanded && "z-20",
        isDragging && "opacity-70 shadow-md",
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <Badge variant="secondary" className="rounded-full px-1.5 py-0.5">
                {getSkillContextLabel(item)}
              </Badge>
              {item.estimatedMinutes != null && item.estimatedMinutes > 0 ? (
                <span>{formatMinutes(item.estimatedMinutes)}</span>
              ) : null}
            </div>
            <p
              className={cn(
                "text-xs font-medium leading-5 text-foreground",
                expanded ? "line-clamp-none" : "line-clamp-2",
              )}
            >
              {item.skillTitle}
            </p>
            <p className="text-[11px] leading-4 text-muted-foreground">
              {getStateLabel(item.state)}
              {item.manualOverrideKind !== "none" ? ` · ${item.manualOverrideKind.replace("_", " ")}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`month-item-details-${item.id}`}
              aria-label={expanded ? `Collapse details for ${item.skillTitle}` : `Expand details for ${item.skillTitle}`}
              className="inline-flex size-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setExpanded((current) => !current)}
            >
              <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
            </button>
            <button
              type="button"
              aria-label={`Drag ${item.skillTitle}`}
              disabled={isSaving}
              className="shrink-0 rounded-md border border-border/70 p-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-3.5" />
            </button>
          </div>
        </div>

        {expanded ? (
          <div
            id={`month-item-details-${item.id}`}
            className="absolute left-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-5rem))] space-y-3 rounded-xl border border-border/70 bg-card px-3 py-3 shadow-[var(--shadow-card)]"
          >
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Skill path
              </p>
              <p className="text-[11px] leading-5 break-words text-muted-foreground">{item.skillPath}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="rounded-full">
                {getStateLabel(item.state)}
              </Badge>
              {item.manualOverrideKind !== "none" ? (
                <Badge variant="secondary" className="rounded-full">
                  {item.manualOverrideKind.replace("_", " ")}
                </Badge>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Position
              </p>
              <p className="text-[11px] leading-5 text-muted-foreground">
                Now {item.currentPosition + 1}
                {item.recommendedPosition !== item.currentPosition
                  ? ` · recommended ${item.recommendedPosition + 1}`
                  : ""}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DayCell({
  day,
  items,
  isSaving,
}: {
  day: MonthlyPlanDay;
  items: WeeklyRouteBoardItem[];
  isSaving: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: day.date,
    disabled: !day.isDroppable,
  });

  return (
    <div
      className={cn(
        "flex min-h-40 min-w-0 flex-col rounded-[1.4rem] border p-3 transition-colors",
        day.inMonth ? "border-border/75 bg-card/82" : "border-border/55 bg-background/55",
        day.isWeekend && "bg-background/40",
        day.isDroppable && isOver && "border-primary/45 bg-primary/6",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[11px] font-semibold tracking-[0.16em] uppercase",
              day.inMonth ? "text-muted-foreground" : "text-muted-foreground/75",
            )}
          >
            {day.shortLabel}
          </p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold",
              day.inMonth ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {day.dayNumber}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {items.length > 0 ? (
            <Badge variant="outline" className="px-2 text-[10px] tracking-[0.12em]">
              {items.length}
            </Badge>
          ) : null}
          {items.length > 0 ? (
            <span className="text-[11px] text-muted-foreground">{formatMinutes(day.scheduledMinutes)}</span>
          ) : null}
        </div>
      </div>

      <div ref={setNodeRef} className="mt-3 flex-1 space-y-2">
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <div
              className={cn(
                "rounded-xl border border-dashed px-2.5 py-4 text-center text-[11px] leading-5",
                day.isWeekend
                  ? "border-border/50 text-muted-foreground/80"
                  : "border-border/70 text-muted-foreground",
              )}
            >
              {day.isWeekend ? "Weekend" : "Drop cards here"}
            </div>
          ) : (
            items.map((item) => <SortableMonthItem key={item.id} item={item} isSaving={isSaving} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function BacklogBucket({
  week,
  items,
  isSaving,
}: {
  week: MonthlyPlanWeek;
  items: WeeklyRouteBoardItem[];
  isSaving: boolean;
}) {
  const columnId = `unassigned:${week.weeklyRouteId}`;
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div
      className={cn(
        "rounded-[1.4rem] border border-border/75 bg-card/82 p-4 transition-colors",
        isOver && "border-primary/45 bg-primary/6",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{week.weekLabel}</p>
          <p className="text-xs text-muted-foreground">Unscheduled route items for this week.</p>
        </div>
        <Link
          href={`/planning?weekStartDate=${week.weekStartDate}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2")}
        >
          Open week
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div ref={setNodeRef} className="mt-3 space-y-2">
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-[11px] text-muted-foreground">
              No backlog
            </div>
          ) : (
            items.map((item) => <SortableMonthItem key={item.id} item={item} isSaving={isSaving} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function MonthPlanningBoard({ month }: MonthPlanningBoardProps) {
  const router = useRouter();
  const initialColumns = createColumns(month);
  const [columns, setColumns] = useState<ColumnsState>(initialColumns);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columnsRef = useRef<ColumnsState>(initialColumns);
  const snapshotRef = useRef<ColumnsState | null>(null);

  useEffect(() => {
    const nextColumns = createColumns(month);
    columnsRef.current = nextColumns;
    setColumns(nextColumns);
    setActiveItemId(null);
    setError(null);
  }, [month]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );

  const allItems = month.weeks.flatMap((week) => [
    ...week.unassignedItems,
    ...week.days.flatMap((day) => day.items),
  ]);
  const itemsById = new Map(allItems.map((item) => [item.id, item]));
  const columnMeta = createColumnMeta(month);
  const hasScheduleChanges = allItems.some(
    (item) =>
      item.manualOverrideKind !== "none" || item.currentPosition !== item.recommendedPosition,
  );

  const persistMove = async (itemId: string, nextColumns: ColumnsState) => {
    const item = itemsById.get(itemId);
    const targetColumnId = findColumnForId(itemId, nextColumns);
    const targetMeta = targetColumnId ? columnMeta.get(targetColumnId) : null;

    if (!item || !targetColumnId || !targetMeta) {
      return;
    }

    const targetIndex = nextColumns[targetColumnId].indexOf(itemId);

    try {
      setError(null);
      setIsSaving(true);

      const response = await fetch(`/api/planning/weekly-route-items/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          weeklyRouteId: item.weeklyRouteId,
          targetWeeklyRouteId: targetMeta.weeklyRouteId,
          targetScheduledDate: targetMeta.scheduledDate,
          targetIndex,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to save the month move.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (updateError) {
      console.error(updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not save this move. The month layout was restored.",
      );

      if (snapshotRef.current) {
        columnsRef.current = snapshotRef.current;
        setColumns(snapshotRef.current);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const refreshSchedule = async () => {
    try {
      setError(null);
      setIsSaving(true);
      setActiveItemId(null);

      const response = await fetch("/api/planning/month-schedule-refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceId: month.sourceId,
          monthDate: month.monthStartDate,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to refresh the curriculum schedule.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (refreshError) {
      console.error(refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not refresh the curriculum schedule.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    if (isSaving) {
      return;
    }

    const id = String(event.active.id);
    setActiveItemId(id);
    snapshotRef.current = columnsRef.current;
  };

  const onDragOver = (event: DragOverEvent) => {
    if (isSaving) {
      return;
    }

    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) {
      return;
    }

    setColumns((current) => {
      const activeColumnId = findColumnForId(activeId, current);
      const overColumnId = findColumnForId(overId, current);
      if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) {
        return current;
      }

      const activeColumnItems = [...current[activeColumnId]];
      const overColumnItems = [...current[overColumnId]];
      const activeIndex = activeColumnItems.indexOf(activeId);
      if (activeIndex < 0) {
        return current;
      }

      activeColumnItems.splice(activeIndex, 1);

      const overIndex = overColumnItems.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : overColumnItems.length;
      overColumnItems.splice(insertAt, 0, activeId);

      const next = {
        ...current,
        [activeColumnId]: activeColumnItems,
        [overColumnId]: overColumnItems,
      };
      columnsRef.current = next;
      return next;
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    if (isSaving) {
      setActiveItemId(null);
      return;
    }

    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    setActiveItemId(null);

    if (!overId) {
      if (snapshotRef.current) {
        columnsRef.current = snapshotRef.current;
        setColumns(snapshotRef.current);
      }
      return;
    }

    const current = columnsRef.current;
    const activeColumnId = findColumnForId(activeId, current);
    const overColumnId = findColumnForId(overId, current);
    if (!activeColumnId || !overColumnId) {
      return;
    }

    let nextColumns = current;
    if (activeColumnId === overColumnId) {
      const currentItems = [...current[activeColumnId]];
      const activeIndex = currentItems.indexOf(activeId);
      const overIndex = currentItems.indexOf(overId);

      if (activeIndex >= 0 && overIndex >= 0 && activeIndex !== overIndex) {
        nextColumns = {
          ...current,
          [activeColumnId]: arrayMove(currentItems, activeIndex, overIndex),
        };
      }
    } else {
      const activeColumnItems = [...current[activeColumnId]];
      const overColumnItems = [...current[overColumnId]];
      const activeIndex = activeColumnItems.indexOf(activeId);

      if (activeIndex >= 0) {
        activeColumnItems.splice(activeIndex, 1);
        const overIndex = overColumnItems.indexOf(overId);
        const insertAt = overIndex >= 0 ? overIndex : overColumnItems.length;
        overColumnItems.splice(insertAt, 0, activeId);
        nextColumns = {
          ...current,
          [activeColumnId]: activeColumnItems,
          [overColumnId]: overColumnItems,
        };
      }
    }

    if (nextColumns !== current) {
      columnsRef.current = nextColumns;
      setColumns(nextColumns);
    }

    await persistMove(activeId, nextColumns);
  };

  const firstWeek = month.weeks[0];

  return (
    <section className="space-y-5">
      <div className="quiet-panel space-y-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="section-meta">Month planning board</p>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              {month.monthLabel}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              The month grid is the draft. Drag route cards across weekdays, keep the full month
              visible, and expand a card inline when you need more context before moving it.
            </p>
          </div>
          <UpdateCurriculumScheduleButton
            hasChanges={hasScheduleChanges}
            isBusy={isSaving}
            onRefresh={refreshSchedule}
            className="lg:max-w-xs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-3.5" />
          <span>{month.summary.daysInMonth} days</span>
          <span>•</span>
          <span>{month.summary.weeksInView} weeks</span>
          <span>•</span>
          <span>{month.summary.scheduledCount} placed</span>
          {hasScheduleChanges ? (
            <>
              <span>•</span>
              <span>Custom order</span>
            </>
          ) : null}
          {month.summary.conflictCount > 0 ? (
            <>
              <span>•</span>
              <span className="text-destructive">{month.summary.conflictCount} conflicts</span>
            </>
          ) : null}
          {isSaving ? (
            <>
              <span>•</span>
              <span>Saving changes…</span>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <DndContext
          id={`month-planning-board-${month.monthStartDate}`}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <Card className="border-border/75 bg-background/90">
            <CardContent>
              <div className="overflow-x-auto pb-2">
                <div className="min-w-0 space-y-3 xl:min-w-[980px]">
                  <div className="grid grid-cols-7 gap-3">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                      <div
                        key={label}
                        className="px-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  {month.weeks.map((week) => (
                    <div key={week.weekStartDate} className="grid grid-cols-7 gap-3">
                      {week.days.map((day) => {
                        const itemIds = day.isDroppable ? columns[day.date] ?? [] : day.items.map((item) => item.id);
                        const items = itemIds
                          .map((itemId) => itemsById.get(itemId))
                          .filter((item): item is WeeklyRouteBoardItem => item != null);

                        return <DayCell key={day.date} day={day} items={items} isSaving={isSaving} />;
                      })}
                    </div>
                  ))}
                </div>
              </div>
              {activeItemId ? (
                <p className="mt-3 text-xs text-muted-foreground">Dragging item {activeItemId}…</p>
              ) : null}
            </CardContent>
          </Card>
        </DndContext>

        <div className="grid gap-6 self-start">
          <aside className="quiet-panel space-y-4 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Month posture</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Keep weekdays interactive and keep weekends visible, so you can inspect the full month at a glance.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-[1.4rem] border border-border/70 bg-card/75 p-4">
              <Layers3 className="mt-1 size-4 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Expandable daily cards</p>
                <p>Every card shows the key label immediately, then opens inline when you need the rest.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[1.4rem] border border-border/70 bg-card/75 p-4">
              <AlertTriangle className="mt-1 size-4 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Weekend context</p>
                <p>Weekend boxes are visible for context, but scheduling still follows weekdays.</p>
              </div>
            </div>
            {firstWeek ? (
              <Link
                href={`/planning?weekStartDate=${firstWeek.weekStartDate}`}
                className={cn(buttonVariants({ variant: "default" }), "w-full")}
              >
                Open the first week
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
            {activeItemId ? (
              <p className="text-xs text-muted-foreground">Dragging item {activeItemId}…</p>
            ) : null}
          </aside>
          <Card className="border-border/75 bg-card/90">
            <CardHeader>
              <CardDescription>Weekly backlog</CardDescription>
              <CardTitle>Unassigned cards</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {month.weeks.map((week) => {
                  const columnId = `unassigned:${week.weeklyRouteId}`;
                  const items = (columns[columnId] ?? [])
                    .map((itemId) => itemsById.get(itemId))
                    .filter((item): item is WeeklyRouteBoardItem => item != null);

                  return (
                    <BacklogBucket
                      key={week.weekStartDate}
                      week={week}
                      items={items}
                      isSaving={isSaving}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
