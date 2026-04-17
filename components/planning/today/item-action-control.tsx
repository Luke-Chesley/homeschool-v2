"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DailyWorkspace } from "@/lib/planning/types";
import {
  saveTodayPlanItemPortfolioAction,
  saveTodayPlanItemEvaluationAction,
  type TodayPlanItemAction,
  updateTodayPlanItemAction,
} from "@/app/(parent)/today/actions";

import { TodayPlanItemEvaluationControl } from "./evaluation-control";
import { getCompletionDisplay } from "./types";

export function TodayItemLearnerLink({ item }: { item: DailyWorkspace["items"][number] }) {
  const sessionId = item.sessionRecordId ?? item.workflow?.lessonSessionId ?? undefined;
  const hasActivity = Boolean(sessionId && item.workflow?.activityCount);

  if (!sessionId) {
    return null;
  }

  return (
    <Link
      href={hasActivity ? `/activity/${sessionId}` : "/learner"}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "min-h-11 w-full justify-center sm:min-h-8 sm:w-auto",
      )}
    >
      {hasActivity ? "Open activity" : "Open queue"}
    </Link>
  );
}

export function TodayPlanItemActionButtons({
  item,
  date,
  alternateWeeklyRouteItemId,
  repeatTomorrowAllowed,
  compact = false,
  onActionSaved,
  onEvaluationSaved,
}: {
  item: DailyWorkspace["items"][number];
  date: string;
  alternateWeeklyRouteItemId?: string;
  repeatTomorrowAllowed?: boolean;
  compact?: boolean;
  onActionSaved: (result: Awaited<ReturnType<typeof updateTodayPlanItemAction>>) => void;
  onEvaluationSaved: (result: Awaited<ReturnType<typeof saveTodayPlanItemEvaluationAction>>) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<TodayPlanItemAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [portfolioMessage, setPortfolioMessage] = useState<string | null>(null);

  useEffect(() => {
    setPendingAction(null);
    setError(null);
    setPortfolioMessage(null);
  }, [item.status, item.completionStatus, item.note]);

  const isDone =
    item.status === "completed" || item.completionStatus === "completed_as_planned";
  const hasSavedCompletion =
    item.completionStatus != null && item.completionStatus !== "not_started";

  function runAction(action: TodayPlanItemAction) {
    setError(null);
    setPendingAction(action);

    startTransition(async () => {
      const result = await updateTodayPlanItemAction({
        date,
        planItemId: item.id,
        action,
        alternateWeeklyRouteItemId,
        planParentId: item.planParentId,
        planDayRecordId: item.planDayRecordId,
        planRecordId: item.planRecordId,
        sessionRecordId: item.sessionRecordId,
        estimatedMinutes: item.estimatedMinutes,
        title: item.title,
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save this change.");
        setPendingAction(null);
        return;
      }

      setSuccessMessage(result.message ?? "Saved.");
      setPendingAction(null);
      onActionSaved(result);
    });
  }

  const confirmationText = getCompletionDisplay(item, successMessage);
  const primaryButtonClassName = compact ? "w-full justify-center sm:w-auto" : "w-full sm:w-auto";

  function saveToPortfolio() {
    if (!item.sessionRecordId) {
      setError("Save a lesson outcome first so there is evidence to add.");
      return;
    }

    setError(null);
    setPortfolioMessage(null);
    startTransition(async () => {
      const result = await saveTodayPlanItemPortfolioAction({
        planItemId: item.id,
        sessionRecordId: item.sessionRecordId ?? "",
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save this lesson to the portfolio.");
        return;
      }

      setPortfolioMessage(result.message ?? "Saved to portfolio.");
    });
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end",
        )}
      >
        <Button
          size="sm"
          disabled={isPending || isDone}
          onClick={() => runAction("complete")}
          className={primaryButtonClassName}
        >
          {pendingAction === "complete" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isDone ? (
            <CheckCircle2 className="size-3.5" />
          ) : null}
          {isDone ? "Done saved" : "Mark done"}
        </Button>
        {hasSavedCompletion ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => runAction("reset")}
            className={primaryButtonClassName}
          >
            {pendingAction === "reset" ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Undo
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={isPending || hasSavedCompletion}
          onClick={() => runAction("partial")}
          className={primaryButtonClassName}
        >
          {pendingAction === "partial" ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Mark partial
        </Button>
      </div>

      {(!compact || repeatTomorrowAllowed || alternateWeeklyRouteItemId) ? (
        <>
          <div className="hidden flex-wrap gap-2 sm:justify-end lg:flex">
            {!compact ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending || hasSavedCompletion}
                onClick={() => runAction("push_to_tomorrow")}
              >
                {pendingAction === "push_to_tomorrow" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Push forward
              </Button>
            ) : null}
            {!compact ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending || hasSavedCompletion}
                onClick={() => runAction("skip_today")}
              >
                {pendingAction === "skip_today" ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Skip today
              </Button>
            ) : null}
            {repeatTomorrowAllowed ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending || hasSavedCompletion}
                onClick={() => runAction("repeat_tomorrow")}
              >
                {pendingAction === "repeat_tomorrow" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Repeat tomorrow
              </Button>
            ) : null}
            {alternateWeeklyRouteItemId ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending || hasSavedCompletion}
                onClick={() => runAction("swap_with_alternate")}
                className="text-muted-foreground"
              >
                {pendingAction === "swap_with_alternate" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                {compact ? "Lighter option" : "Use lighter option"}
              </Button>
            ) : null}
          </div>

          <details className="rounded-xl border border-border/60 bg-background/75 lg:hidden">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-foreground">
              More actions
            </summary>
            <div className="grid gap-2 border-t border-border/60 px-3 py-3">
              {!compact ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending || hasSavedCompletion}
                  onClick={() => runAction("push_to_tomorrow")}
                  className="w-full justify-center"
                >
                  {pendingAction === "push_to_tomorrow" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Push forward
                </Button>
              ) : null}
              {!compact ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending || hasSavedCompletion}
                  onClick={() => runAction("skip_today")}
                  className="w-full justify-center"
                >
                  {pendingAction === "skip_today" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Skip today
                </Button>
              ) : null}
              {repeatTomorrowAllowed ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending || hasSavedCompletion}
                  onClick={() => runAction("repeat_tomorrow")}
                  className="w-full justify-center"
                >
                  {pendingAction === "repeat_tomorrow" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Repeat tomorrow
                </Button>
              ) : null}
              {alternateWeeklyRouteItemId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending || hasSavedCompletion}
                  onClick={() => runAction("swap_with_alternate")}
                  className="w-full justify-center text-muted-foreground"
                >
                  {pendingAction === "swap_with_alternate" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  {compact ? "Lighter option" : "Use lighter option"}
                </Button>
              ) : null}
            </div>
          </details>
        </>
      ) : null}

      <TodayPlanItemEvaluationControl
        item={item}
        date={date}
        onEvaluationSaved={onEvaluationSaved}
      />

      {item.sessionRecordId ? (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={saveToPortfolio}
          className={primaryButtonClassName}
        >
          {isPending && pendingAction === null ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save to portfolio
        </Button>
      ) : null}

      {confirmationText ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
          <CheckCircle2 className="size-4 text-primary" />
          <span>{confirmationText}</span>
        </div>
      ) : null}

      {portfolioMessage ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
          <CheckCircle2 className="size-4 text-primary" />
          <span>{portfolioMessage}</span>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
