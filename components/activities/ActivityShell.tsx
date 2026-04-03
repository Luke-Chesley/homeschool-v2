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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">{title}</h2>
          {instructions && (
            <p className="mt-1 text-sm text-muted-foreground">{instructions}</p>
          )}
        </div>
        {estimatedMinutes && (
          <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            ~{estimatedMinutes} min
          </div>
        )}
      </div>

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div>{children}</div>

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl p-4 text-sm",
            feedback.correct
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          )}
        >
          <CheckCircle className="size-4 shrink-0 mt-0.5" />
          <span>{feedback.message ?? (feedback.correct ? "Correct!" : "Not quite — try again.")}</span>
        </div>
      )}

      {/* Submitted state */}
      {submitted && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-4 text-sm text-primary">
          <CheckCircle className="size-4" />
          Activity submitted. Great work!
        </div>
      )}

      {/* Actions */}
      {!submitted && (onSubmit || onSkip) && (
        <div className="flex items-center justify-between gap-3 pt-2">
          {onSkip && (
            <Button variant="ghost" size="sm" onClick={onSkip} disabled={submitting}>
              Skip
            </Button>
          )}
          {onSubmit && (
            <Button
              className="ml-auto"
              size="sm"
              onClick={onSubmit}
              disabled={submitting || submitDisabled}
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
