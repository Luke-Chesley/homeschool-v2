"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  LESSON_EVALUATION_OPTIONS,
  type LessonEvaluationLevel,
} from "@/lib/session-workspace/evaluation";
import { cn } from "@/lib/utils";

interface LessonEvaluationPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLevel: LessonEvaluationLevel | null;
  onLevelChange: (level: LessonEvaluationLevel) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  error?: string | null;
}

export function LessonEvaluationPopover({
  open,
  onOpenChange,
  selectedLevel,
  onLevelChange,
  note,
  onNoteChange,
  onSubmit,
  submitting = false,
  error,
}: LessonEvaluationPopoverProps) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        onOpenChange(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div ref={wrapperRef} className="absolute right-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))]">
      <Card className="border-border/70 bg-background/98 shadow-[var(--shadow-card)]">
        <div className="space-y-4 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">How well did the learner complete this task?</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Pick the broadest signal that fits. You can add a short note for context.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {LESSON_EVALUATION_OPTIONS.map((option) => {
              const active = selectedLevel === option.level;

              return (
                <button
                  key={option.level}
                  type="button"
                  onClick={() => onLevelChange(option.level)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/6"
                      : "border-border bg-card/60 hover:bg-muted/40",
                  )}
                >
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Optional note
            </label>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={3}
              placeholder="What happened?"
              className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting || selectedLevel == null}
              onClick={onSubmit}
            >
              {submitting ? "Saving..." : "Save evaluation"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
