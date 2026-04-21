"use client";

import { useRef, useState } from "react";
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
import { ChevronDown, Copy, GripVertical, SlidersHorizontal } from "lucide-react";

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

function getScheduledLabel(scheduledDate: string | null) {
  if (!scheduledDate) {
    return "Backlog";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${scheduledDate}T12:00:00.000Z`));
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

  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
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
        "min-w-0 rounded-xl border border-border/60 bg-background/88 p-3 shadow-sm",
        isDragging && "opacity-70 shadow-md",
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <Badge variant="secondary" className="rounded-full px-2 py-0.5">
                {getSkillContextLabel(item)}
              </Badge>
              {minutesLabel ? <span>{minutesLabel}</span> : null}
              <span>{getScheduledLabel(item.scheduledDate)}</span>
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
            className="shrink-0 rounded-md border border-border/70 p-1 text-muted-foreground transition-colors hover:text-foreground"
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
            className="space-y-3 rounded-xl border border-border/70 bg-card/72 p-3"
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
            className="space-y-3 rounded-xl border border-border/70 bg-card/72 p-3"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground" htmlFor={`route-state-${item.id}`}>
                State
              </label>
              <select
                id={`route-state-${item.id}`}
                disabled={isSaving}
                value={item.state}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
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
        isOver && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{getColumnLabel(columnId)}</p>
        <p className="text-xs text-muted-foreground">
          {items.length} planned items
          {scheduledMinutes > 0 ? ` · ${scheduledMinutes} min` : ""}
        </p>
      </div>
      <div ref={setNodeRef} className="min-w-0 space-y-2">
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
              Drop items here
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

export function WeeklyRouteBoard({ initialBoard, weekStartDate }: WeeklyRouteBoardProps) {
  const weekDates = getWeekdayDates(weekStartDate);
  const columnOrder = ["unassigned", ...weekDates];
  const initialColumns = createColumns(initialBoard.items, weekDates);
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

  const resetFromServerBoard = (nextBoard: WeeklyRouteBoard) => {
    const nextColumns = createColumns(nextBoard.items, weekDates);
    setBoard(nextBoard);
    columnsRef.current = nextColumns;
    setColumns(nextColumns);
  };

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
      <div className="quiet-panel space-y-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="section-meta">Weekly plan</p>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              Shape the week without rebuilding it.
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Drag work into the right day, pause items that are too much, and leave overflow in a
              flexible holding area until you are ready to schedule it.
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
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
              const items = columns[columnId]
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
        <aside className="quiet-panel space-y-4 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">How to use this board</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Keep the week realistic. Leave cards compact while you sort the calendar, then open
              details or actions only on the items that need a closer decision.
            </p>
          </div>
          <div className="space-y-2">
            {STATE_OPTIONS.map((option) => (
              <div key={option.value} className="rounded-xl border border-border/60 bg-background/72 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground">
                  {option.value === "queued"
                    ? "Not assigned to a day yet."
                    : option.value === "scheduled"
                      ? "Committed to the week but not started."
                      : option.value === "in_progress"
                        ? "Already underway."
                        : option.value === "done"
                          ? "Completed for now."
                          : "Temporarily off the board."}
                </p>
              </div>
            ))}
          </div>
          {activeItemId ? (
            <p className="text-xs text-muted-foreground">Dragging item {activeItemId}…</p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
