"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";

import { LessonPlanPanel } from "@/components/planning/lesson-plan-panel";
import {
  LessonDraftRenderer,
  LegacyLessonDraftNotice,
} from "@/components/planning/lesson-draft-renderer";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import type { DailyWorkspace, DailyWorkspaceLessonDraft } from "@/lib/planning/types";
import { cn } from "@/lib/utils";
import {
  generateLessonDraftActivityAction,
  getLessonDraftPromptPreviewAction,
  type LessonDraftActivityStatus,
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

type PromptPreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; systemPrompt: string; userPrompt: string }
  | { status: "error"; message: string };

function LessonDraftPromptPreview({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PromptPreviewState>({ status: "idle" });

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (preview.status === "ready") return;
    setPreview({ status: "loading" });
    const result = await getLessonDraftPromptPreviewAction(date);
    if (result.ok && result.systemPrompt && result.userPrompt) {
      setPreview({ status: "ready", systemPrompt: result.systemPrompt, userPrompt: result.userPrompt });
    } else {
      setPreview({ status: "error", message: result.error ?? "Failed to load prompt" });
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
      >
        {preview.status === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : null}
        <span>{open ? "Hide prompt" : "View prompt"}</span>
        <span className="text-xs opacity-50">debug</span>
      </button>

      {open && preview.status === "ready" ? (
        <div className="mt-3 rounded-lg border border-border/70 bg-background p-4">
          <div className="grid gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-foreground">System</p>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
                {preview.systemPrompt}
              </pre>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-foreground">User</p>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
                {preview.userPrompt}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
      {open && preview.status === "error" ? (
        <p className="mt-2 text-xs text-destructive">{preview.message}</p>
      ) : null}
    </div>
  );
}

/**
 * Lesson-draft activity control panel.
 *
 * Displays the current activity state and provides generate / regenerate
 * affordances. Placed in the lesson draft area — not on plan item cards.
 *
 * States:
 *   - no_activity: show generate button
 *   - stale: show warning + regenerate button (draft changed since last gen)
 *   - ready: show open activity link
 */
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
  const canGenerate = localStatus === "no_activity" || localStatus === "stale";

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

      <LessonDraftPromptPreview date={date} />
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
      <Card className="border-dashed">
        <div className="flex flex-col gap-4 p-6">
          <div>
            <p className="text-sm text-muted-foreground">{formatPlannerDate(workspace.date)}</p>
            <h2 className="mt-1 font-serif text-2xl">{workspace.learner.name}</h2>
          </div>
          <p className="text-sm text-muted-foreground">No route items are ready for today.</p>
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
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:items-start">
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
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)] xl:items-start">
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
      <section className="space-y-4 xl:sticky xl:top-24">
        <div className="border-b border-border/70 pb-4">
          <p className="text-sm text-muted-foreground">{formatPlannerDate(workspace.date)}</p>
          <h2 className="font-serif text-2xl">Route</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {workspace.items.length} items · {totalMinutes} min
          </p>
        </div>

        <div className="space-y-2">
          {workspace.items.map((item, index) => {
            const alternate = workspace.alternatesByPlanItemId[item.id]?.[0];

            return (
              <Card key={item.id}>
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
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/today?date=${workspace.date}&action=complete&planItemId=${item.id}`}
                      className={buttonVariants({ variant: "default", size: "sm" })}
                    >
                      Complete
                    </Link>
                    {repeatTomorrowAllowed ? (
                      <Link
                        href={`/today?date=${workspace.date}&action=repeat_tomorrow&planItemId=${item.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Repeat
                      </Link>
                    ) : null}
                    {alternate ? (
                      <Link
                        href={`/today?date=${workspace.date}&action=swap_with_alternate&planItemId=${item.id}&alternateWeeklyRouteItemId=${alternate.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
                      >
                        Swap
                      </Link>
                    ) : null}
                  </div>
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
          <h2 className="font-serif text-2xl">Daily plan</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{workspace.items.length} items</span>
          <span>{totalMinutes} min</span>
          <span>{workspace.sessionTargets.length} targets</span>
        </div>
      </div>

      <div className="space-y-3">
        {workspace.items.map((item, index) => {
          const alternate = workspace.alternatesByPlanItemId[item.id]?.[0];

          return (
            <Card key={item.id}>
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
                      </div>
                    ) : null}
                    {item.note ? <p className="text-sm text-muted-foreground">{item.note}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Link
                      href={`/today?date=${workspace.date}&action=complete&planItemId=${item.id}`}
                      className={buttonVariants({ variant: "default", size: "sm" })}
                    >
                      Complete
                    </Link>
                    <Link
                      href={`/today?date=${workspace.date}&action=push_to_tomorrow&planItemId=${item.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Tomorrow
                    </Link>
                    {repeatTomorrowAllowed ? (
                      <Link
                        href={`/today?date=${workspace.date}&action=repeat_tomorrow&planItemId=${item.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Repeat
                      </Link>
                    ) : null}
                    {alternate ? (
                      <Link
                        href={`/today?date=${workspace.date}&action=swap_with_alternate&planItemId=${item.id}&alternateWeeklyRouteItemId=${alternate.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
                      >
                        Swap
                      </Link>
                    ) : null}
                  </div>
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
  // Activity state for this lesson draft — server-loaded via props (or refreshed)
  // We use null as the initial state; the control itself handles the button
  // for legacy sessions that already have activities.
  const leadSessionId = workspace.leadItem.sessionRecordId ?? workspace.leadItem.workflow?.lessonSessionId ?? undefined;

  return (
    <section className="space-y-4">
      <div className="border-b border-border/70 pb-4">
        <p className="text-sm text-muted-foreground">{workspace.leadItem.sourceLabel}</p>
        <h2 className="font-serif text-3xl">Lesson draft</h2>
      </div>

      <Card>
        <div className="p-5 sm:p-6">
          {draftState.kind === "structured" ? (
            <LessonDraftRenderer draft={draftState.draft} />
          ) : draftState.kind === "markdown" ? (
            <div className="space-y-4">
              <LegacyLessonDraftNotice />
              <MarkdownContent content={draftState.markdown} />
            </div>
          ) : null}
        </div>
      </Card>

      {/* Activity generation — owned by the lesson draft, not by individual items */}
      {draftState.kind === "structured" ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Activity</h3>
          <p className="text-xs text-muted-foreground">
            One activity generated from this lesson draft. Regenerate when the draft changes.
          </p>
          <LessonDraftActivityControl
            date={workspace.date}
            activityStatus={null}
            sessionId={leadSessionId}
          />
        </div>
      ) : null}
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
