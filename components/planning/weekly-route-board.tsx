"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowLeft, ArrowRight, ChevronDown, Copy, GripVertical, SlidersHorizontal } from "lucide-react";

import { UpdateCurriculumScheduleButton } from "@/components/planning/update-curriculum-schedule-button";
import { buttonVariants } from "@/components/ui/button";
import type { WeeklyRouteBoard, WeeklyRouteBoardItem } from "@/lib/curriculum-routing";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ColumnId = string;
type ColumnsState = Record<ColumnId, string[]>;

interface WeeklyRouteBoardProps {
  initialBoard: WeeklyRouteBoard;
  weekStartDate: string;
  navigation?: {
    previousHref: string;
    nextHref: string;
    rangeLabel: string;
  };
}

const STATE_OPTIONS: Array<{ value: WeeklyRouteBoardItem["state"]; label: string }> = [
  { value: "queued", label: "Backlog" },
  { value: "scheduled", label: "Planned" },
  { value: "in_progress", label: "Working" },
  { value: "done", label: "Done" },
  { value: "removed", label: "Paused" },
];

function getStateLabel(state: WeeklyRouteBoardItem["state"]) {
  return STATE_OPTIONS.find((option) => option.value === state)?.label ?? state;
}

function getSkillContextLabel(item: WeeklyRouteBoardItem) {
  return item.skillPath.split(/[·/]/)[0]?.trim() || item.skillPath;
}

function getMinutesLabel(minutes: number | null) {
  return minutes == null || minutes === 0 ? null : `${minutes} min`;
}

function parseDateOrThrow(value: string) {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed;
}

function addDays(baseDate: string, days: number) {
  const date = parseDateOrThrow(baseDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekdayDates(weekStartDate: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
}

function getColumnLabel(columnId: ColumnId) {
  if (columnId === "unassigned") {
    return "Flex / unscheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(
    new Date(`${columnId}T12:00:00.000Z`),
  );
}

function toColumnId(item: WeeklyRouteBoardItem, weekDates: string[]): ColumnId {
  if (item.scheduledDate && weekDates.includes(item.scheduledDate)) {
    return item.scheduledDate;
  }

  return "unassigned";
}

function createColumns(items: WeeklyRouteBoardItem[], weekDates: string[]) {
  const columns: ColumnsState = {
    unassigned: [],
  };

  for (const date of weekDates) {
    columns[date] = [];
  }

  const orderedItems = [...items].sort((left, right) => left.currentPosition - right.currentPosition);
  for (const item of orderedItems) {
    const columnId = toColumnId(item, weekDates);
    columns[columnId].push(item.id);
  }

  return columns;
}

function normalizeColumns(columns: ColumnsState, weekDates: string[]) {
  return {
    ...createColumns([], weekDates),
    ...columns,
  };
}

function findColumnForId(id: string, columns: ColumnsState) {
  if (Object.hasOwn(columns, id)) {
    return id;
  }

  return Object.keys(columns).find((columnId) => columns[columnId].includes(id));
}

function SortableRouteItem({
  item,
  conflicted,
  isSaving,
  canRepeat,
  onChangeState,
  onDuplicate,
}: {
  item: WeeklyRouteBoardItem;
  conflicted: boolean;
  isSaving: boolean;
  canRepeat: boolean;
  onChangeState: (itemId: string, state: WeeklyRouteBoardItem["state"]) => Promise<void>;
  onDuplicate: (itemId: string, targetScheduledDate: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const prerequisiteCount =
    item.explicitPrerequisiteSkillNodeIds.length + item.predecessorSkillNodeIds.length;
  const minutesLabel = getMinutesLabel(item.estimatedMinutes);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "min-w-0 rounded-[calc(var(--radius)+0.1rem)] border border-border/60 bg-card/84 p-3.5 shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color,background-color] duration-[var(--motion-base)] ease-[var(--ease-standard)] hover:-translate-y-px hover:shadow-[var(--shadow-card)]",
        isDragging && "border-primary/30 bg-card opacity-70 shadow-[var(--shadow-active)]",
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <Badge
                variant="secondary"
                className="max-w-[14rem] rounded-full px-2 py-0.5 truncate whitespace-nowrap"
                title={getSkillContextLabel(item)}
              >
                {getSkillContextLabel(item)}
              </Badge>
              {minutesLabel ? <span>{minutesLabel}</span> : null}
              {!item.scheduledDate ? <span>Backlog</span> : null}
            </div>
            <p className="text-sm font-semibold leading-5 break-words">{item.skillTitle}</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="rounded-full">
                {getStateLabel(item.state)}
              </Badge>
              {item.manualOverrideKind !== "none" ? (
                <Badge variant="secondary" className="rounded-full">
                  {item.manualOverrideKind.replace("_", " ")}
                </Badge>
              ) : null}
              {conflicted ? (
                <Badge variant="outline" className="rounded-full text-destructive">
                  Conflict
                </Badge>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            aria-label={`Drag ${item.skillTitle}`}
            className="shrink-0 rounded-xl border border-border/70 bg-background/72 p-1.5 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2">
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={`route-item-details-${item.id}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 rounded-full px-3 text-xs",
            )}
            onClick={() => setDetailsOpen((current) => !current)}
          >
            Details
            <ChevronDown className={cn("size-3.5 transition-transform", detailsOpen && "rotate-180")} />
          </button>
          <button
            type="button"
            aria-expanded={actionsOpen}
            aria-controls={`route-item-actions-${item.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-8 rounded-full px-3 text-xs",
            )}
            onClick={() => setActionsOpen((current) => !current)}
          >
            <SlidersHorizontal className="size-3.5" />
            Actions
          </button>
        </div>

        {detailsOpen ? (
          <div
            id={`route-item-details-${item.id}`}
            className="space-y-3 rounded-[calc(var(--radius)-0.05rem)] border border-border/70 bg-background/74 p-3"
          >
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Path</p>
                <p className="leading-5 break-words">{item.skillPath}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Prerequisites</p>
                <p className="leading-5">
                  {prerequisiteCount === 0 ? "No blockers recorded." : `${prerequisiteCount} prerequisite links`}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Position</p>
                <p className="leading-5">
                  Now {item.currentPosition + 1} · Recommended {item.recommendedPosition + 1}
                </p>
              </div>
            </div>
            {item.manualOverrideNote ? (
              <div className="rounded-lg border border-border/60 bg-background/72 px-3 py-2">
                <p className="text-xs font-medium text-foreground">Planner note</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.manualOverrideNote}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {actionsOpen ? (
          <div
            id={`route-item-actions-${item.id}`}
            className="space-y-3 rounded-[calc(var(--radius)-0.05rem)] border border-border/70 bg-background/74 p-3"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground" htmlFor={`route-state-${item.id}`}>
                State
              </label>
              <select
                id={`route-state-${item.id}`}
                disabled={isSaving}
                value={item.state}
                className="field-shell h-10"
                onChange={(event) =>
                  void onChangeState(item.id, event.currentTarget.value as WeeklyRouteBoardItem["state"])
                }
              >
                {STATE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canRepeat ? (
                <button
                  type="button"
                  disabled={isSaving}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 rounded-full")}
                  onClick={() => {
                    if (!item.scheduledDate) {
                      return;
                    }
                    void onDuplicate(item.id, addDays(item.scheduledDate, 1));
                  }}
                >
                  <Copy className="size-4" />
                  Repeat tomorrow
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Repeat is available once this item is placed on a weekday.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RouteColumn({
  columnId,
  items,
  conflictedItemIds,
  isSaving,
  weekDates,
  onChangeState,
  onDuplicate,
}: {
  columnId: ColumnId;
  items: WeeklyRouteBoardItem[];
  conflictedItemIds: Set<string>;
  isSaving: boolean;
  weekDates: string[];
  onChangeState: (itemId: string, state: WeeklyRouteBoardItem["state"]) => Promise<void>;
  onDuplicate: (itemId: string, targetScheduledDate: string) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const scheduledMinutes = items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);

  return (
    <section
      data-weekly-column={columnId}
      className={cn(
        "quiet-panel min-h-56 min-w-0 space-y-4 p-4",
        isOver && "border-primary/40 bg-primary/6 shadow-[var(--shadow-active)]",
      )}
    >
      <div className="space-y-1 border-b border-border/60 pb-3">
        <p className="text-sm font-semibold text-foreground">{getColumnLabel(columnId)}</p>
        <p className="text-xs text-muted-foreground">
          {items.length} planned items
          {scheduledMinutes > 0 ? ` · ${scheduledMinutes} min` : ""}
        </p>
      </div>
      <div ref={setNodeRef} className="min-w-0 space-y-2">
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <div className="rounded-[calc(var(--radius)-0.05rem)] border border-dashed border-border/80 bg-background/52 px-3 py-5 text-center text-xs text-muted-foreground">
              Drop items here to build this day.
            </div>
          ) : (
            items.map((item) => (
              <SortableRouteItem
                key={item.id}
                item={item}
                conflicted={conflictedItemIds.has(item.id)}
                isSaving={isSaving}
                canRepeat={
                  item.state !== "removed" &&
                  item.scheduledDate != null &&
                  weekDates.includes(addDays(item.scheduledDate, 1))
                }
                onChangeState={onChangeState}
                onDuplicate={onDuplicate}
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}

export function WeeklyRouteBoard({ initialBoard, weekStartDate, navigation }: WeeklyRouteBoardProps) {
  const weekDates = useMemo(() => getWeekdayDates(weekStartDate), [weekStartDate]);
  const columnOrder = useMemo(() => ["unassigned", ...weekDates], [weekDates]);
  const initialColumns = useMemo(
    () => createColumns(initialBoard.items, weekDates),
    [initialBoard, weekDates],
  );
  const [board, setBoard] = useState(initialBoard);
  const [columns, setColumns] = useState<ColumnsState>(initialColumns);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columnsRef = useRef<ColumnsState>(initialColumns);
  const snapshotRef = useRef<{ board: WeeklyRouteBoard; columns: ColumnsState } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );

  const itemsById = new Map(board.items.map((item) => [item.id, item]));
  const conflictedItemIds = new Set(board.conflicts.flatMap((conflict) => conflict.affectedItemIds));
  const hasScheduleChanges = board.items.some(
    (item) =>
      item.manualOverrideKind !== "none" || item.currentPosition !== item.recommendedPosition,
  );
  const visibleColumns = normalizeColumns(columns, weekDates);

  const resetFromServerBoard = (nextBoard: WeeklyRouteBoard) => {
    const nextColumns = createColumns(nextBoard.items, weekDates);
    setBoard(nextBoard);
    columnsRef.current = nextColumns;
    setColumns(nextColumns);
  };

  useEffect(() => {
    setBoard(initialBoard);
    columnsRef.current = initialColumns;
    setColumns(initialColumns);
    setActiveItemId(null);
    setError(null);
    setIsSaving(false);
  }, [initialBoard, initialColumns]);

  const persistState = async (itemId: string, nextState: WeeklyRouteBoardItem["state"]) => {
    const item = board.items.find((entry) => entry.id === itemId);
    if (!item || item.state === nextState) {
      return;
    }

    try {
      setError(null);
      setIsSaving(true);
      snapshotRef.current = {
        board,
        columns: columnsRef.current,
      };

      const response = await fetch(`/api/planning/weekly-route-items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          weeklyRouteId: board.summary.weeklyRouteId,
          state: nextState,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to persist weekly route state update.");
      }

      const updatedBoard = (await response.json()) as WeeklyRouteBoard;
      resetFromServerBoard(updatedBoard);
    } catch (updateError) {
      console.error(updateError);
      setError("Could not save this state change. The board was restored.");
      if (snapshotRef.current) {
        setBoard(snapshotRef.current.board);
        columnsRef.current = snapshotRef.current.columns;
        setColumns(snapshotRef.current.columns);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const persistMove = async (itemId: string, nextColumns: ColumnsState) => {
    const targetColumnId = findColumnForId(itemId, nextColumns);
    if (!targetColumnId) {
      return;
    }

    const targetIndex = nextColumns[targetColumnId].indexOf(itemId);
    const targetScheduledDate = targetColumnId === "unassigned" ? null : targetColumnId;

    try {
      setError(null);
      setIsSaving(true);

      const response = await fetch(`/api/planning/weekly-route-items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          weeklyRouteId: board.summary.weeklyRouteId,
          targetScheduledDate,
          targetIndex,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to persist weekly route update.");
      }

      const updatedBoard = (await response.json()) as WeeklyRouteBoard;
      resetFromServerBoard(updatedBoard);
    } catch (updateError) {
      console.error(updateError);
      setError("Could not save this move. The board was restored.");
      if (snapshotRef.current) {
        setBoard(snapshotRef.current.board);
        columnsRef.current = snapshotRef.current.columns;
        setColumns(snapshotRef.current.columns);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const persistDuplicate = async (itemId: string, targetScheduledDate: string) => {
    const item = board.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    try {
      setError(null);
      setIsSaving(true);
      snapshotRef.current = {
        board,
        columns: columnsRef.current,
      };

      const response = await fetch(`/api/planning/weekly-route-items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          weeklyRouteId: board.summary.weeklyRouteId,
          duplicateTargetDate: targetScheduledDate,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to duplicate the route item.");
      }

      const updatedBoard = (await response.json()) as WeeklyRouteBoard;
      resetFromServerBoard(updatedBoard);
    } catch (updateError) {
      console.error(updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not duplicate this item. The board was restored.",
      );

      if (snapshotRef.current) {
        setBoard(snapshotRef.current.board);
        columnsRef.current = snapshotRef.current.columns;
        setColumns(snapshotRef.current.columns);
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

      const response = await fetch(
        `/api/planning/weekly-routes/${board.summary.weeklyRouteId}/refresh-schedule`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to refresh the curriculum schedule.");
      }

      const updatedBoard = (await response.json()) as WeeklyRouteBoard;
      resetFromServerBoard(updatedBoard);
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
    snapshotRef.current = {
      board,
      columns: columnsRef.current,
    };
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

      const reordered = {
        ...current,
        [activeColumnId]: activeColumnItems,
        [overColumnId]: overColumnItems,
      };
      columnsRef.current = reordered;
      return reordered;
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
        setBoard(snapshotRef.current.board);
        columnsRef.current = snapshotRef.current.columns;
        setColumns(snapshotRef.current.columns);
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

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {navigation ? (
              <>
                <Link href={navigation.previousHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <ArrowLeft className="size-4" />
                  Previous week
                </Link>
                <div className="rounded-full border border-border/70 bg-background/72 px-3 py-1.5 text-sm text-foreground">
                  {navigation.rangeLabel}
                </div>
                <Link href={navigation.nextHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Next week
                  <ArrowRight className="size-4" />
                </Link>
              </>
            ) : (
              <div className="rounded-full border border-border/70 bg-background/72 px-3 py-1.5 text-sm text-foreground">
                Week of {weekStartDate}
              </div>
            )}
          </div>
          <UpdateCurriculumScheduleButton
            hasChanges={hasScheduleChanges}
            isBusy={isSaving}
            onRefresh={refreshSchedule}
            className="lg:max-w-xs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Week of {weekStartDate}</span>
          <span>•</span>
          <span>{board.items.length} items</span>
          {hasScheduleChanges ? (
            <>
              <span>•</span>
              <span>Custom order</span>
            </>
          ) : null}
          {board.conflicts.length > 0 ? (
            <>
              <span>•</span>
              <span>{board.conflicts.length} conflict{board.conflicts.length === 1 ? "" : "s"}</span>
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
      <div className="grid gap-4">
        <DndContext
          id={`weekly-route-board-${weekStartDate}`}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div
            data-weekly-board
            className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]"
          >
            {columnOrder.map((columnId) => {
              const items = visibleColumns[columnId]
                .map((itemId) => itemsById.get(itemId))
                .filter((item): item is WeeklyRouteBoardItem => item != null);

              return (
                <RouteColumn
                  key={columnId}
                  columnId={columnId}
                  items={items}
                  conflictedItemIds={conflictedItemIds}
                  isSaving={isSaving}
                  weekDates={weekDates}
                  onChangeState={persistState}
                  onDuplicate={persistDuplicate}
                />
              );
            })}
          </div>
        </DndContext>
        {activeItemId ? (
          <p className="rounded-2xl border border-primary/20 bg-primary/6 px-3 py-2 text-xs text-muted-foreground">
            Dragging item {activeItemId}…
          </p>
        ) : null}
      </div>
    </section>
  );
}
