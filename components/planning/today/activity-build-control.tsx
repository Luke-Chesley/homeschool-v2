"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { acquireAutoBuildLock, releaseAutoBuildLock } from "@/lib/planning/client-auto-build";
import type {
  DailyWorkspace,
  DailyWorkspaceActivityBuildTrigger,
  DailyWorkspaceActivityState,
} from "@/lib/planning/types";
import { generateLessonDraftActivityAction } from "@/app/(parent)/today/actions";

import type { DraftState } from "./types";
import { formatMinutes } from "./types";

export function LessonDraftActivityControl({
  date,
  sourceId,
  slotId,
  routeFingerprint,
  activityState,
  sessionId,
  buildState,
  onActivityPatch,
}: {
  date: string;
  sourceId?: string;
  slotId: string;
  routeFingerprint: string;
  activityState: DailyWorkspaceActivityState | null;
  sessionId?: string;
  buildState?: DailyWorkspace["activityBuild"];
  onActivityPatch: (patch: {
    activityBuild?: DailyWorkspace["activityBuild"] | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingTrigger, setPendingTrigger] = useState<DailyWorkspaceActivityBuildTrigger | null>(
    null,
  );

  useEffect(() => {
    setError(null);
  }, [activityState?.activityId, activityState?.status, buildState?.status, buildState?.updatedAt]);

  const autoBuildKey =
    buildState?.status === "queued"
      ? `${buildState.routeFingerprint}:${buildState.queuedAt ?? buildState.updatedAt}`
      : null;

  function handleGenerate(
    trigger: DailyWorkspaceActivityBuildTrigger = "manual",
    autoBuildLockKey?: string | null,
  ) {
    setError(null);
    setPendingTrigger(trigger);
    startTransition(async () => {
      const result = await generateLessonDraftActivityAction({
        date,
        sourceId: sourceId ?? "",
        slotId,
        routeFingerprint,
        lessonSessionId: activityState?.sessionId ?? sessionId ?? null,
        trigger,
      });
      setPendingTrigger(null);

      if (!result.ok) {
        if (autoBuildLockKey) {
          releaseAutoBuildLock("today-activity-auto", autoBuildLockKey);
        }
        setError(result.error ?? "Generation failed");
        return;
      }

      onActivityPatch({
        activityBuild: result.build ?? buildState ?? null,
        activityState: result.activityState ?? activityState,
      });
    });
  }

  useEffect(() => {
    if (!autoBuildKey) {
      return;
    }

    if (!acquireAutoBuildLock("today-activity-auto", autoBuildKey)) {
      return;
    }

    handleGenerate("after_lesson_auto", autoBuildKey);
  }, [autoBuildKey]);

  const localStatus = activityState?.status ?? null;
  const localSessionId = activityState?.sessionId ?? sessionId;
  const isPendingAutoBuild = pendingTrigger === "after_lesson_auto";
  const isBuildingActivity =
    buildState?.status === "queued" || buildState?.status === "generating" || isPendingAutoBuild;
  const buildFailed = buildState?.status === "failed";
  const isStale = localStatus === "stale" && !isBuildingActivity;
  const isReady = localStatus === "ready" && !isBuildingActivity && !buildFailed;
  const hasActivity = localStatus === "ready" || localStatus === "stale";
  const canGenerate =
    !isBuildingActivity &&
    (buildFailed || localStatus === null || localStatus === "no_activity" || localStatus === "stale");
  const openSessionId = localSessionId ?? activityState?.sessionId ?? sessionId;
  const actionLabel = isPending
    ? buildFailed
      ? "Retrying…"
      : isStale
        ? "Regenerating…"
        : "Generating…"
    : buildFailed
      ? "Retry build"
      : isStale
        ? "Regenerate activity"
        : "Generate activity";

  return (
    <div className="space-y-3">
      {isBuildingActivity ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Building activity…</p>
            <p className="text-xs text-muted-foreground">
              We&apos;re turning the lesson draft into a runnable activity automatically.
            </p>
          </div>
        </div>
      ) : null}

      {isReady ? (
        <div className="flex items-start gap-2 rounded-lg border border-secondary/35 bg-secondary/12 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-secondary-foreground" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Activity ready</p>
            <p className="text-xs text-muted-foreground">
              The learner-facing activity is ready to open from today.
            </p>
          </div>
        </div>
      ) : null}

      {isStale ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/8 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Activity is stale</p>
            <p className="text-xs text-muted-foreground">
              The lesson draft changed after this activity was generated. Regenerate to reflect the
              current lesson.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        {openSessionId && hasActivity ? (
          <Link
            href={`/activity/${openSessionId}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "min-h-11 w-full justify-center sm:min-h-8 sm:w-auto",
            )}
          >
            {isStale ? "Open (stale)" : "Open activity"}
          </Link>
        ) : null}

        {canGenerate && !isBuildingActivity ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerate(buildFailed ? "today_resume" : "manual")}
            disabled={isPending}
            className="min-h-11 w-full justify-center sm:min-h-8 sm:w-auto"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {actionLabel}
          </Button>
        ) : null}

        {buildFailed && !error ? (
          <p className="text-xs text-destructive">
            {buildState?.error ?? "Activity generation did not finish. Retry to build it again."}
          </p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

export function TodayLearnerActivityBridge({
  workspace,
  draftState,
  sourceId,
  slotId,
  routeFingerprint,
  onActivityPatch,
}: {
  workspace: DailyWorkspace;
  draftState: DraftState;
  sourceId?: string;
  slotId: string;
  routeFingerprint: string;
  onActivityPatch: (patch: {
    activityBuild?: DailyWorkspace["activityBuild"] | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) => void;
}) {
  const leadSessionId =
    workspace.leadItem.sessionRecordId ?? workspace.leadItem.workflow?.lessonSessionId ?? undefined;
  const activitySessionId = workspace.activityState?.sessionId ?? leadSessionId;
  const hasActivity =
    workspace.activityState?.status === "ready" || workspace.activityState?.status === "stale";
  const activitySummary =
    workspace.activityBuild?.status === "queued" || workspace.activityBuild?.status === "generating"
      ? "activity building"
      : workspace.activityState?.status === "stale"
        ? "activity stale"
        : hasActivity
          ? "activity ready"
          : null;

  return (
    <Card className="quiet-panel">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Learner work</span>
            <span>{formatMinutes(workspace.leadItem.estimatedMinutes)}</span>
            {activitySummary ? <span>{activitySummary}</span> : null}
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-xl leading-tight tracking-tight sm:text-2xl">
              {workspace.leadItem.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              Open the live activity or hand off the learner queue from the same place.
            </p>
          </div>
        </div>

        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          {hasActivity && activitySessionId ? (
            <Link
              href={`/activity/${activitySessionId}`}
              className={cn(buttonVariants({ size: "sm" }), "min-h-11 w-full justify-center sm:min-h-8 sm:w-auto")}
            >
              Open learner activity
            </Link>
          ) : (
            <Link
              href="/learner"
              className={cn(buttonVariants({ size: "sm" }), "min-h-11 w-full justify-center sm:min-h-8 sm:w-auto")}
            >
              Open learner queue
            </Link>
          )}
          <Link
            href="/learner"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "min-h-11 w-full justify-center sm:min-h-8 sm:w-auto",
            )}
          >
            View queue
          </Link>
          {draftState?.kind === "structured" ? (
            <LessonDraftActivityControl
              date={workspace.date}
              sourceId={sourceId}
              slotId={slotId}
              routeFingerprint={routeFingerprint}
              activityState={workspace.activityState}
              sessionId={workspace.activityState?.sessionId ?? leadSessionId}
              buildState={workspace.activityBuild}
              onActivityPatch={onActivityPatch}
            />
          ) : null}
        </div>
      </div>
    </Card>
  );
}
