"use client";

/**
 * ActivityShell — wraps any activity renderer with common chrome:
 * progress indicator, timer, submit button, and feedback banner.
 */

import * as React from "react";
import { Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ActivityShellProps {
  title: string;
  instructions?: string;
  /** 0–1 progress for the activity, or undefined if N/A */
  progress?: number;
  estimatedMinutes?: number;
  onSubmit?: () => void;
  onSkip?: () => void;
  submitDisabled?: boolean;
  submitting?: boolean;
  submitted?: boolean;
  feedback?: { correct: boolean; message?: string };
  children: React.ReactNode;
}

export function ActivityShell({
  title,
  instructions,
  progress,
  estimatedMinutes,
  onSubmit,
  onSkip,
  submitDisabled,
  submitting,
  submitted,
  feedback,
  children,
}: ActivityShellProps) {
  return (
    <div className="learner-reading-surface">
      <div className="learner-reading-column flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="font-serif text-[2rem] leading-tight tracking-tight text-foreground">{title}</h2>
            {instructions ? <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{instructions}</p> : null}
          </div>
          {estimatedMinutes ? (
            <div className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-border/80 px-2.5 py-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {estimatedMinutes} min
            </div>
          ) : null}
        </div>

        {progress !== undefined ? (
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{Math.round(progress * 100)}%</span>
          </div>
        ) : null}

        <div>{children}</div>

        {feedback ? (
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
              feedback.correct
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                : "border-red-200 bg-red-50/80 text-red-800",
            )}
          >
            <CheckCircle className="mt-0.5 size-4 shrink-0" />
            <span>{feedback.message ?? (feedback.correct ? "Correct." : "Not quite yet. Try again.")}</span>
          </div>
        ) : null}

        {submitted ? (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/7 px-4 py-3 text-sm text-foreground">
            <CheckCircle className="size-4 text-primary" />
            Activity submitted. Great work.
          </div>
        ) : null}

        {!submitted && (onSubmit || onSkip) ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
            {onSkip ? (
              <Button variant="ghost" size="sm" onClick={onSkip} disabled={submitting}>
                Skip
              </Button>
            ) : null}
            {onSubmit ? (
              <Button
                className="ml-auto"
                size="sm"
                onClick={onSubmit}
                disabled={submitting || submitDisabled}
              >
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
