"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  DailyWorkspaceActivityBuild,
  DailyWorkspaceLessonBuild,
} from "@/lib/planning/types";
import { consumeOnboardingLaunchSummary, type OnboardingLaunchSummary } from "@/lib/homeschool/onboarding/launch-summary";

type StageStatus = "waiting" | "active" | "ready" | "failed";

function isActiveBuild(
  build?: DailyWorkspaceLessonBuild | DailyWorkspaceActivityBuild | null,
) {
  return build?.status === "queued" || build?.status === "generating";
}

function StageChip(props: { label: string; status: StageStatus }) {
  if (props.status === "ready") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-foreground">
        <CheckCircle2 className="size-3.5 text-primary" />
        {props.label}
      </span>
    );
  }

  if (props.status === "active") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground">
        <Loader2 className="size-3.5 animate-spin text-primary" />
        {props.label}
      </span>
    );
  }

  if (props.status === "failed") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-destructive/25 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
        <AlertCircle className="size-3.5" />
        {props.label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-border/70 bg-background/72 px-3 py-1 text-xs font-medium text-muted-foreground">
      {props.label}
    </span>
  );
}

function buildBannerCopy(params: {
  summary: OnboardingLaunchSummary | null;
  lessonBuild?: DailyWorkspaceLessonBuild | null;
  activityBuild?: DailyWorkspaceActivityBuild | null;
  hasDraft: boolean;
}) {
  const lessonBuildActive = isActiveBuild(params.lessonBuild);
  const activityBuildActive = isActiveBuild(params.activityBuild);
  const hasReadyLesson =
    params.hasDraft || params.lessonBuild?.status === "ready";

  if (params.lessonBuild?.status === "failed") {
    return {
      title: params.summary
        ? "Today opened, but the first lesson draft did not finish."
        : "The lesson draft did not finish.",
      detail:
        params.lessonBuild.error ??
        "Retry the draft build from Today. The saved route is still in place.",
    };
  }

  if (params.activityBuild?.status === "failed") {
    return {
      title: "The lesson draft is ready, but the learner activity did not finish.",
      detail:
        params.activityBuild.error ??
        "Retry the activity build from Today.",
    };
  }

  if (params.summary && lessonBuildActive) {
    return {
      title: "Building the first lesson",
      detail: params.summary.summaryText,
    };
  }

  if (params.summary && hasReadyLesson && activityBuildActive) {
    return {
      title: "Building the activity",
      detail: params.summary.summaryText,
    };
  }

  if (params.summary) {
    return {
      title: "Onboarding setup ready",
      detail: params.summary.summaryText,
    };
  }

  if (lessonBuildActive) {
    return {
      title: params.hasDraft ? "Updating today’s lesson draft" : "Building today’s lesson draft",
      detail: "This may take a moment.",
    };
  }

  if (activityBuildActive) {
    return {
      title: "Building the activity",
      detail: "This may take a moment.",
    };
  }

  return null;
}

export function OnboardingLaunchFlash(props: {
  lessonBuild?: DailyWorkspaceLessonBuild | null;
  activityBuild?: DailyWorkspaceActivityBuild | null;
  hasDraft?: boolean;
}) {
  const [summary, setSummary] = React.useState<OnboardingLaunchSummary | null>(null);

  React.useEffect(() => {
    setSummary(consumeOnboardingLaunchSummary());
  }, []);

  const hasDraft = props.hasDraft ?? false;
  const copy = buildBannerCopy({
    summary,
    lessonBuild: props.lessonBuild,
    activityBuild: props.activityBuild,
    hasDraft,
  });
  const showBanner =
    summary !== null ||
    isActiveBuild(props.lessonBuild) ||
    isActiveBuild(props.activityBuild) ||
    props.lessonBuild?.status === "failed" ||
    props.activityBuild?.status === "failed";

  if (!showBanner || !copy) {
    return null;
  }

  const lessonStage: { label: string; status: StageStatus } =
    props.lessonBuild?.status === "failed"
      ? { label: "Lesson draft failed", status: "failed" }
      : isActiveBuild(props.lessonBuild)
        ? {
            label:
              props.lessonBuild?.status === "queued"
                ? "Lesson draft queued"
                : hasDraft
                  ? "Lesson draft updating"
                  : "Lesson draft building",
            status: "active",
          }
        : hasDraft || props.lessonBuild?.status === "ready"
          ? { label: "Lesson draft ready", status: "ready" }
          : { label: "Lesson draft next", status: "waiting" };
  const activityStage: { label: string; status: StageStatus } =
    props.activityBuild?.status === "failed"
      ? { label: "Activity build failed", status: "failed" }
      : isActiveBuild(props.activityBuild)
        ? {
            label:
              props.activityBuild?.status === "queued"
                ? "Activity queued"
                : "Activity generating",
            status: "active",
          }
        : props.activityBuild?.status === "ready"
          ? { label: "Activity ready", status: "ready" }
          : lessonStage.status === "ready"
            ? { label: "Activity available next", status: "waiting" }
            : { label: "Waiting on lesson draft", status: "waiting" };

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{copy.title}</p>
          <p className="break-words">{copy.detail}</p>
          {summary?.scopeSummary ? (
            <p className="break-words text-muted-foreground">{summary.scopeSummary}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <StageChip label="Route ready" status="ready" />
            <StageChip label={lessonStage.label} status={lessonStage.status} />
            <StageChip label={activityStage.label} status={activityStage.status} />
          </div>
        </div>
        {summary ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSummary(null)}
            className="shrink-0 text-foreground hover:bg-primary/10"
          >
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}
