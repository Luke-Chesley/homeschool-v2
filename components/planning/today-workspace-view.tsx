"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { LessonPlanPanel } from "@/components/planning/lesson-plan-panel";
import { LessonEvaluationPopover } from "@/components/planning/lesson-evaluation-popover";
import {
  LessonDraftRenderer,
  LegacyLessonDraftNotice,
} from "@/components/planning/lesson-draft-renderer";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import { type LessonEvaluationLevel } from "@/lib/session-workspace/evaluation";
import type { DailyWorkspace, DailyWorkspaceLessonDraft } from "@/lib/planning/types";
import { cn } from "@/lib/utils";
import {
  generateLessonDraftActivityAction,
  saveTodayPlanItemEvaluationAction,
  type LessonDraftActivityStatus,
  type TodayPlanItemAction,
  updateTodayPlanItemAction,
} from "@/app/(parent)/today/actions";

interface TodayWorkspaceViewProps {
  workspace: DailyWorkspace;
  sourceId?: string;
}

interface TodayRouteItemsSectionProps {
  workspace: DailyWorkspace;
  sourceId?: string;
  repeatTomorrowAllowed?: boolean;
}

function formatMinutes(minutes: number) {
  return `${minutes} min`;
}

function formatPlannerDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function getStatusLabel(status: string) {
  return status.replace("_", " ");
}

function getReviewLabel(reviewState?: string | null) {
  if (!reviewState || reviewState === "not_required") {
    return null;
  }

  return reviewState.replaceAll("_", " ");
}

function canRepeatToTomorrow(date: string) {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 4;
}

function getCompletionDisplay(
  item: DailyWorkspace["items"][number],
  feedbackMessage?: string | null,
) {
  if (feedbackMessage) {
    return feedbackMessage;
  }

  if (item.completionStatus === "completed_as_planned") {
    return "Confirmed done and saved to today's record.";
  }

  if (item.completionStatus === "partially_completed") {
    return "Marked partial and carried forward.";
  }

  if (item.completionStatus === "skipped") {
    return "Skipped today and recorded.";
  }

  return null;
}

// Typed draft state: can hold structured, legacy markdown, or null
type DraftState =
  | { kind: "structured"; draft: StructuredLessonDraft }
  | { kind: "markdown"; markdown: string }
  | null;

function initialDraftState(lessonDraft: DailyWorkspaceLessonDraft | null): DraftState {
  if (!lessonDraft) return null;
  if (lessonDraft.structured) {
    return { kind: "structured", draft: lessonDraft.structured };
  }
  if (lessonDraft.markdown) {
    return { kind: "markdown", markdown: lessonDraft.markdown };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lesson-draft activity control: generate / regenerate / stale / ready
// ---------------------------------------------------------------------------

function LessonDraftActivityControl({
  date,
  activityStatus,
  sessionId,
}: {
  date: string;
  activityStatus: LessonDraftActivityStatus | null;
  sessionId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<LessonDraftActivityStatus | null>(activityStatus);

  useEffect(() => {
    setLocalStatus(activityStatus);
  }, [activityStatus]);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateLessonDraftActivityAction(date);
      if (result.ok) {
        setLocalStatus("ready");
        router.refresh();
      } else {
        setError(result.error ?? "Generation failed");
      }
    });
  }

  const isStale = localStatus === "stale";
  const hasActivity = localStatus === "ready" || localStatus === "stale";
  const canGenerate = localStatus === null || localStatus === "no_activity" || localStatus === "stale";

  return (
    <div className="space-y-3">
      {isStale ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium text-amber-800 dark:text-amber-200">Activity is stale</p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              The lesson draft changed after this activity was generated. Regenerate to reflect the
              current lesson.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {sessionId && hasActivity ? (
          <Link
            href={`/activity/${sessionId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {isStale ? "Open (stale)" : "Open activity"}
          </Link>
        ) : null}

        {canGenerate ? (
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {isPending
              ? isStale
                ? "Regenerating…"
                : "Generating…"
              : isStale
                ? "Regenerate activity"
                : "Generate activity"}
          </Button>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

function TodayLearnerActivityBridge({
  workspace,
  draftState,
}: {
  workspace: DailyWorkspace;
  draftState: DraftState;
}) {
  const leadSessionId =
    workspace.leadItem.sessionRecordId ?? workspace.leadItem.workflow?.lessonSessionId ?? undefined;
  const hasActivity = Boolean(leadSessionId && workspace.leadItem.workflow?.activityCount);

  return (
    <Card className="quiet-panel">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="section-meta">Learner work</p>
          <div className="space-y-1">
            <h2 className="font-serif text-2xl tracking-tight">Move directly from the daily plan into learner work.</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Keep the day in view here, then open the learner queue or the live activity without switching mental models.
            </p>
          </div>
          <div className="toolbar-row text-sm text-muted-foreground">
            <span>{workspace.leadItem.title}</span>
            <span>{formatMinutes(workspace.leadItem.estimatedMinutes)}</span>
            {workspace.leadItem.workflow?.activityCount ? (
              <span>{workspace.leadItem.workflow.activityCount} activity ready</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {hasActivity ? (
            <Link href={`/activity/${leadSessionId}`} className={buttonVariants({ size: "sm" })}>
              Open learner activity
            </Link>
          ) : (
            <Link href="/learner" className={buttonVariants({ size: "sm" })}>
              Open learner queue
            </Link>
          )}
          <Link href="/learner" className={buttonVariants({ variant: "outline", size: "sm" })}>
            View queue
          </Link>
          {draftState?.kind === "structured" ? (
            <LessonDraftActivityControl date={workspace.date} activityStatus={null} sessionId={leadSessionId} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function TodayItemLearnerLink({ item }: { item: DailyWorkspace["items"][number] }) {
  const sessionId = item.sessionRecordId ?? item.workflow?.lessonSessionId ?? undefined;
  const hasActivity = Boolean(sessionId && item.workflow?.activityCount);

  if (!sessionId) {
    return null;
  }

  return (
    <Link
      href={hasActivity ? `/activity/${sessionId}` : "/learner"}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      {hasActivity ? "Open activity" : "Open queue"}
    </Link>
  );
}

function TodayPlanItemActionButtons({
  item,
  date,
  alternateWeeklyRouteItemId,
  repeatTomorrowAllowed,
  compact = false,
}: {
  item: DailyWorkspace["items"][number];
  date: string;
  alternateWeeklyRouteItemId?: string;
  repeatTomorrowAllowed?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<TodayPlanItemAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setPendingAction(null);
    setError(null);
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
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save this change.");
        setPendingAction(null);
        return;
      }

      setSuccessMessage(result.message ?? "Saved.");
      setPendingAction(null);
      router.refresh();
    });
  }

  const confirmationText = getCompletionDisplay(item, successMessage);
  const primaryButtonClassName = compact ? "w-full justify-center sm:w-auto" : "w-full sm:w-auto";

  return (
    <div className="space-y-2">
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end")}>
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
          {pendingAction === "reset" ? (
            <Loader2 className="size-3.5 animate-spin" />
            ) : null}
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

      <TodayPlanItemEvaluationControl item={item} date={date} />

      {confirmationText ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
          <CheckCircle2 className="size-4 text-primary" />
          <span>{confirmationText}</span>
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

type SavedEvaluation = {
  level: LessonEvaluationLevel;
  label: string;
  note: string | null;
  createdAt: string;
};

function TodayPlanItemEvaluationControl({
  item,
  date,
}: {
  item: DailyWorkspace["items"][number];
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<LessonEvaluationLevel | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedEvaluation, setSavedEvaluation] = useState<SavedEvaluation | null>(null);

  useEffect(() => {
    setOpen(false);
    setSelectedLevel(null);
    setNote("");
    setError(null);
    setSavedEvaluation(null);
  }, [item.id]);

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

    setError(null);
    startTransition(async () => {
      const result = await saveTodayPlanItemEvaluationAction({
        date,
        planItemId: item.id,
        level: selectedLevel,
        note,
      });

      if (!result.ok || !result.evaluation) {
        setError(result.error ?? "Could not save this evaluation.");
        return;
      }

      setSavedEvaluation(result.evaluation);
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

// ---------------------------------------------------------------------------

export function TodayWorkspaceView({ workspace, sourceId }: TodayWorkspaceViewProps) {
  const [draftState, setDraftState] = useState<DraftState>(
    () => initialDraftState(workspace.lessonDraft),
  );
  const repeatTomorrowAllowed = canRepeatToTomorrow(workspace.date);

  useEffect(() => {
    setDraftState(initialDraftState(workspace.lessonDraft));
  }, [workspace.date, workspace.leadItem.id, workspace.lessonDraft, sourceId]);

  function handleDraftChange(incoming: StructuredLessonDraft | string | null) {
    if (incoming === null) {
      setDraftState(null);
    } else if (typeof incoming === "string") {
      setDraftState({ kind: "markdown", markdown: incoming });
    } else {
      setDraftState({ kind: "structured", draft: incoming });
    }
  }

  if (workspace.items.length === 0) {
    return (
      <Card className="quiet-panel max-w-4xl border-dashed">
        <div className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="mt-1 font-serif text-2xl">Nothing is queued for today.</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            No route items are ready for {workspace.learner.name} today. Open curriculum or planning to
            shape the next workable day.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/curriculum" className={buttonVariants({ variant: "default", size: "sm" })}>
              Open curriculum
            </Link>
            <Link href="/planning" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open planning
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  if (draftState) {
    return (
      <div className="space-y-6">
        <TodayLearnerActivityBridge workspace={workspace} draftState={draftState} />
        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_20rem] xl:items-start">
          <TodayRouteItemsSection
            workspace={workspace}
            sourceId={sourceId}
            repeatTomorrowAllowed={repeatTomorrowAllowed}
            compact
          />
          <TodayLessonDraftArticle workspace={workspace} draftState={draftState} />
          <TodayLessonPlanSection
            workspace={workspace}
            sourceId={sourceId}
            draftState={draftState}
            onDraftChange={handleDraftChange}
            showDraftOutput={false}
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TodayLearnerActivityBridge workspace={workspace} draftState={draftState} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)] xl:items-start">
        <TodayRouteItemsSection
          workspace={workspace}
          sourceId={sourceId}
          repeatTomorrowAllowed={repeatTomorrowAllowed}
        />
        <TodayLessonPlanSection
          workspace={workspace}
          sourceId={sourceId}
          draftState={null}
          onDraftChange={handleDraftChange}
        />
      </div>
    </div>
  );
}

export function TodayRouteItemsSection({
  workspace,
  sourceId,
  repeatTomorrowAllowed = false,
  compact = false,
}: TodayRouteItemsSectionProps & { compact?: boolean }) {
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  if (compact) {
    return (
      <section className="space-y-4 xl:sticky xl:top-32">
        <div className="border-b border-border/70 pb-4">
          <p className="text-sm text-muted-foreground">{formatPlannerDate(workspace.date)}</p>
          <h2 className="font-serif text-2xl">Today</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {workspace.items.length} items · {totalMinutes} min
          </p>
        </div>

        <div className="space-y-2">
          {workspace.items.map((item, index) => {
            const alternate = workspace.alternatesByPlanItemId[item.id]?.[0];

            return (
              <Card key={item.id} className="quiet-panel">
                <div className="space-y-3 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <Badge variant="outline">{item.subject}</Badge>
                    <span>{formatMinutes(item.estimatedMinutes)}</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium leading-5 text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.objective}</p>
                  </div>
                  {item.workflow ? (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{item.workflow.evidenceCount} evidence</span>
                      {item.workflow.activityCount ? <span>{item.workflow.activityCount} activity</span> : null}
                    </div>
                  ) : null}
                  <div className="pt-1">
                    <TodayItemLearnerLink item={item} />
                  </div>
                  <TodayPlanItemActionButtons
                    item={item}
                    date={workspace.date}
                    alternateWeeklyRouteItemId={alternate?.id}
                    repeatTomorrowAllowed={repeatTomorrowAllowed}
                    compact
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{formatPlannerDate(workspace.date)}</p>
          <h2 className="font-serif text-2xl">Queue</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{workspace.items.length} items</span>
          <span>{totalMinutes} min</span>
        </div>
      </div>

      <div className="space-y-3">
        {workspace.items.map((item, index) => {
          const alternate = workspace.alternatesByPlanItemId[item.id]?.[0];

          return (
            <Card
              key={item.id}
              className={cn(
                "quiet-panel",
                item.status === "completed" || item.completionStatus === "completed_as_planned"
                  ? "border-primary/30 bg-primary/5"
                  : undefined,
              )}
            >
              <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Badge variant="outline">{item.subject}</Badge>
                      <Badge variant="outline">{formatMinutes(item.estimatedMinutes)}</Badge>
                      {item.status !== "ready" ? <Badge>{getStatusLabel(item.status)}</Badge> : null}
                      {item.completionStatus && item.completionStatus !== "not_started" ? (
                        <Badge variant="secondary">{getStatusLabel(item.completionStatus)}</Badge>
                      ) : null}
                      {getReviewLabel(item.reviewState) ? (
                        <Badge variant="outline">{getReviewLabel(item.reviewState)}</Badge>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-serif text-xl leading-tight">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.objective}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.lessonLabel}</p>
                    {item.workflow ? (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{item.workflow.evidenceCount} evidence</span>
                        {item.workflow.activityCount ? <span>{item.workflow.activityCount} activity</span> : null}
                      </div>
                    ) : null}
                    {item.note ? <p className="text-sm text-muted-foreground">{item.note}</p> : null}
                    <TodayItemLearnerLink item={item} />
                  </div>

                  <TodayPlanItemActionButtons
                    item={item}
                    date={workspace.date}
                    alternateWeeklyRouteItemId={alternate?.id}
                    repeatTomorrowAllowed={repeatTomorrowAllowed}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function TodayLessonDraftArticle({
  workspace,
  draftState,
}: {
  workspace: DailyWorkspace;
  draftState: DraftState & { kind: string };
}) {
  const draftContent =
    draftState.kind === "structured" ? (
      <LessonDraftRenderer draft={draftState.draft} />
    ) : draftState.kind === "markdown" ? (
      <div className="space-y-4">
        <LegacyLessonDraftNotice />
        <MarkdownContent content={draftState.markdown} />
      </div>
    ) : null;

  return (
    <section className="space-y-4">
      <div className="border-b border-border/70 pb-4">
        <p className="text-sm text-muted-foreground">{workspace.leadItem.sourceLabel}</p>
        <h2 className="font-serif text-3xl">Lesson draft</h2>
      </div>

      <details className="group rounded-[var(--radius)] border border-border/70 bg-card md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground">
          <span>Open full lesson draft</span>
          <span className="text-xs text-muted-foreground transition group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-border/70 px-4 py-4">
          <div className="reading-column">{draftContent}</div>
        </div>
      </details>

      <Card className="reading-surface hidden md:block">
        <div className="reading-column">{draftContent}</div>
      </Card>
    </section>
  );
}

export function TodayLessonPlanSection({
  workspace,
  sourceId,
  draftState,
  onDraftChange,
  showDraftOutput = true,
  compact = false,
}: TodayWorkspaceViewProps & {
  draftState?: DraftState;
  onDraftChange?: (draft: StructuredLessonDraft | string | null) => void;
  showDraftOutput?: boolean;
  compact?: boolean;
}) {
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const contextKey = JSON.stringify({
    date: workspace.date,
    sourceId,
    leadItemId: workspace.leadItem.id,
    objectives: workspace.sessionTargets,
    routeItems: workspace.items.map((item) => ({
      id: item.id,
      title: item.title,
      objective: item.objective,
      lessonLabel: item.lessonLabel,
    })),
  });

  return (
    <div className={cn(compact && "xl:sticky xl:top-24")}>
      <LessonPlanPanel
        key={contextKey}
        date={workspace.date}
        sourceId={sourceId}
        sourceTitle={workspace.leadItem.sourceLabel}
        routeItemCount={workspace.items.length}
        totalMinutes={totalMinutes}
        objectiveCount={workspace.sessionTargets.length}
        objectives={workspace.sessionTargets}
        routeItemTitles={workspace.items.map((item) => item.title)}
        draftState={draftState ?? null}
        onDraftChange={onDraftChange}
        showDraftOutput={showDraftOutput}
      />
    </div>
  );
}
