"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { LessonEvaluationPopover } from "@/components/planning/lesson-evaluation-popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type LessonEvaluationLevel } from "@/lib/session-workspace/evaluation";
import type { DailyWorkspace } from "@/lib/planning/types";
import { saveTodayPlanItemEvaluationAction } from "@/app/(parent)/today/actions";

type SavedEvaluation = {
  level: LessonEvaluationLevel;
  label: string;
  note: string | null;
  createdAt: string;
};

export function TodayPlanItemEvaluationControl({
  item,
  date,
  onEvaluationSaved,
}: {
  item: DailyWorkspace["items"][number];
  date: string;
  onEvaluationSaved: (result: Awaited<ReturnType<typeof saveTodayPlanItemEvaluationAction>>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<LessonEvaluationLevel | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedEvaluation, setSavedEvaluation] = useState<SavedEvaluation | null>(
    item.latestEvaluation
      ? {
          level: item.latestEvaluation.level,
          label: item.latestEvaluation.label,
          note: item.latestEvaluation.note ?? null,
          createdAt: item.latestEvaluation.createdAt,
        }
      : null,
  );

  useEffect(() => {
    setOpen(false);
    setSelectedLevel(null);
    setNote("");
    setError(null);
    setSavedEvaluation(
      item.latestEvaluation
        ? {
            level: item.latestEvaluation.level,
            label: item.latestEvaluation.label,
            note: item.latestEvaluation.note ?? null,
            createdAt: item.latestEvaluation.createdAt,
          }
        : null,
    );
  }, [item.id, item.latestEvaluation]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setError(null);
    }
  }

  function handleSubmit() {
    if (!selectedLevel) {
      setError("Choose an evaluation level first.");
      return;
    }

    if (!item.planRecordId || !item.sessionRecordId) {
      setError("This lesson card is still syncing. Try again in a moment.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await saveTodayPlanItemEvaluationAction({
        date,
        planItemId: item.id,
        weeklyRouteItemId: item.id,
        planRecordId: item.planRecordId ?? "",
        sessionRecordId: item.sessionRecordId ?? "",
        level: selectedLevel,
        note,
      });

      if (!result.ok || !result.evaluation) {
        setError(result.error ?? "Could not save this evaluation.");
        return;
      }

      setSavedEvaluation(result.evaluation);
      onEvaluationSaved(result);
      setOpen(false);
      setSelectedLevel(null);
      setNote("");
    });
  }

  return (
    <div className="relative flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => handleOpenChange(!open)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          savedEvaluation ? "border-primary/30 bg-primary/5 text-primary" : undefined,
        )}
      >
        {open ? "Close" : "Evaluate"}
      </button>

      {savedEvaluation ? (
        <p className="max-w-[16rem] text-right text-xs leading-5 text-muted-foreground">
          Saved: <span className="font-medium text-foreground">{savedEvaluation.label}</span>
          {savedEvaluation.note ? <span>{` · ${savedEvaluation.note}`}</span> : null}
        </p>
      ) : null}

      <LessonEvaluationPopover
        open={open}
        onOpenChange={handleOpenChange}
        selectedLevel={selectedLevel}
        onLevelChange={setSelectedLevel}
        note={note}
        onNoteChange={setNote}
        onSubmit={handleSubmit}
        submitting={isPending}
        error={error}
      />
    </div>
  );
}

export function LessonDraftOutcomeControl({
  item,
  date,
  onEvaluationSaved,
}: {
  item: DailyWorkspace["items"][number];
  date: string;
  onEvaluationSaved: (result: Awaited<ReturnType<typeof saveTodayPlanItemEvaluationAction>>) => void;
}) {
  type SavedLessonOutcome = {
    level: LessonEvaluationLevel;
    label: string;
    note?: string | null;
    createdAt: string;
  };

  const [pendingLevel, setPendingLevel] = useState<LessonEvaluationLevel | null>(null);
  const [savedEvaluation, setSavedEvaluation] = useState<SavedLessonOutcome | null>(
    item.latestEvaluation ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPendingLevel(null);
    setSavedEvaluation(item.latestEvaluation ?? null);
    setError(null);
  }, [item.id, item.latestEvaluation]);

  function saveOutcome(level: LessonEvaluationLevel) {
    if (!item.planRecordId || !item.sessionRecordId) {
      setError("This lesson card is still syncing. Try again in a moment.");
      return;
    }

    const planRecordId = item.planRecordId;
    const sessionRecordId = item.sessionRecordId;
    setError(null);
    setPendingLevel(level);

    startTransition(async () => {
      const result = await saveTodayPlanItemEvaluationAction({
        date,
        planItemId: item.id,
        weeklyRouteItemId: item.id,
        planRecordId,
        sessionRecordId,
        level,
      });

      if (!result.ok || !result.evaluation) {
        setError(result.error ?? "Could not save this lesson outcome.");
        setPendingLevel(null);
        return;
      }

      setSavedEvaluation(result.evaluation);
      onEvaluationSaved(result);
      setPendingLevel(null);
      setOpen(false);
    });
  }

  const options: Array<{
    level: LessonEvaluationLevel;
    label: string;
    toneClassName?: string;
  }> = [
    {
      level: "successful",
      label: "Complete",
      toneClassName: "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
    },
    {
      level: "partial",
      label: "Partial",
    },
    {
      level: "needs_more_work",
      label: "Needs support",
    },
  ];

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!target.closest(`[data-lesson-outcome-root="${item.id}"]`)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [item.id, open]);

  return (
    <div className="relative" data-lesson-outcome-root={item.id}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          savedEvaluation ? "border-primary/20 text-foreground" : undefined,
        )}
      >
        <span>How&apos;d it go?</span>
        {savedEvaluation ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none text-foreground">
            {savedEvaluation.label}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-border/70 bg-background/98 p-2 shadow-[var(--shadow-card)]">
          <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Save lesson outcome
          </p>
          <div className="grid gap-1">
            {options.map((option) => {
              const active = savedEvaluation?.level === option.level;
              const loading = pendingLevel === option.level;

              return (
                <button
                  key={option.level}
                  type="button"
                  onClick={() => saveOutcome(option.level)}
                  disabled={isPending}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-9 items-center justify-between rounded-md border border-border bg-background px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                    active ? option.toneClassName : undefined,
                    active && !option.toneClassName ? "border-foreground/20 bg-muted/60" : undefined,
                  )}
                >
                  <span>{option.label}</span>
                  {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                </button>
              );
            })}
          </div>
          {error ? <p className="px-2 pt-2 text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
