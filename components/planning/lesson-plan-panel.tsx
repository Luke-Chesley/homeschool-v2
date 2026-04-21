"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { LearningCorePromptPreviewCard } from "@/components/debug/LearningCorePromptPreviewCard";
import { useStudio } from "@/components/studio/studio-provider";
import { StudioDrawer } from "@/components/studio/StudioDrawer";
import { LessonDraftActivityControl } from "@/components/planning/today/activity-build-control";
import {
  LessonDraftRenderer,
  LegacyLessonDraftNotice,
} from "@/components/planning/lesson-draft-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import type {
  DailyWorkspaceActivityBuild,
  DailyWorkspaceActivityState,
  DailyWorkspaceExpansionIntent,
  DailyWorkspaceExpansionScope,
  DailyWorkspaceLessonBuild,
  DailyWorkspaceLessonDraft,
} from "@/lib/planning/types";
import { acquireAutoBuildLock, releaseAutoBuildLock } from "@/lib/planning/client-auto-build";
import { cn } from "@/lib/utils";
import {
  expandTodayRouteAction,
  saveExpansionIntentAction,
  type TodayWorkspacePatch,
} from "@/app/(parent)/today/actions";

const LESSON_PLAN_PROMPT_PANEL_ID = "lesson-plan-prompt-preview";

type DraftState =
  | { kind: "structured"; draft: StructuredLessonDraft }
  | { kind: "markdown"; markdown: string }
  | null;

interface LessonPlanPanelProps {
  date: string;
  sourceId?: string;
  slotId?: string;
  slotLabel?: string;
  slotPosition?: number;
  routeFingerprint: string;
  sourceTitle: string;
  routeItemCount: number;
  totalMinutes: number;
  daySkillCount?: number;
  daySlotCount?: number;
  objectiveCount: number;
  objectives: string[];
  routeItemTitles: string[];
  draftState?: DraftState;
  buildState?: DailyWorkspaceLessonBuild | null;
  activityBuild?: DailyWorkspaceActivityBuild | null;
  activityState?: DailyWorkspaceActivityState | null;
  lessonSessionId?: string;
  expansionIntent?: DailyWorkspaceExpansionIntent | null;
  onLessonPatch?: (patch: {
    lessonDraft?: DailyWorkspaceLessonDraft | null;
    lessonBuild?: DailyWorkspaceLessonBuild | null;
    activityBuild?: DailyWorkspaceActivityBuild | null;
  }) => void;
  onActivityPatch?: (patch: {
    activityBuild?: DailyWorkspaceActivityBuild | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) => void;
  onExpansionIntentChange?: (intent: DailyWorkspaceExpansionIntent | null) => void;
  onWorkspacePatch?: (patch?: TodayWorkspacePatch) => void;
  showDraftOutput?: boolean;
}

type LessonPlanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; draft: StructuredLessonDraft }
  | { status: "error"; message: string };

type PromptDebugPreview = {
  operation_name: string;
  skill_name: string;
  skill_version: string;
  request_id: string;
  allowed_tools: string[];
  system_prompt: string;
  user_prompt: string;
  request_envelope: unknown;
};

type PromptDebugState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: PromptDebugPreview }
  | { status: "error"; message: string };

export function LessonPlanPanel({
  date,
  sourceId,
  slotId,
  slotLabel,
  slotPosition,
  routeFingerprint,
  sourceTitle,
  routeItemCount,
  totalMinutes,
  daySkillCount,
  daySlotCount,
  objectiveCount,
  objectives,
  routeItemTitles,
  draftState,
  buildState,
  activityBuild,
  activityState,
  lessonSessionId,
  expansionIntent,
  onLessonPatch,
  onActivityPatch,
  onExpansionIntentChange,
  onWorkspacePatch,
  showDraftOutput = true,
}: LessonPlanPanelProps) {
  const resolvedSlotId = slotId ?? routeFingerprint.replace(/^slot:/, "");
  const [state, setState] = useState<LessonPlanState>({ status: "idle" });
  const [promptDebugState, setPromptDebugState] = useState<PromptDebugState>({ status: "idle" });
  const [activeTrigger, setActiveTrigger] = useState<
    "onboarding_auto" | "today_resume" | "manual" | null
  >(null);
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [savingIntent, setSavingIntent] = useState<DailyWorkspaceExpansionIntent | null>(null);
  const [expandingScope, setExpandingScope] = useState<DailyWorkspaceExpansionScope | null>(null);
  const { access, isEnabled: studioEnabled, openPanel } = useStudio();
  const contextKey = useMemo(
    () =>
      JSON.stringify({
        date,
        sourceId,
        slotId: resolvedSlotId,
        routeFingerprint,
        sourceTitle,
        routeItemCount,
        totalMinutes,
        objectiveCount,
        objectives,
        routeItemTitles,
      }),
    [
      date,
      sourceId,
      resolvedSlotId,
      routeFingerprint,
      sourceTitle,
      routeItemCount,
      totalMinutes,
      objectiveCount,
      objectives,
      routeItemTitles,
    ],
  );

  useEffect(() => {
    setState({ status: "idle" });
    setPromptDebugState({ status: "idle" });
    setActiveTrigger(null);
    setSupportMessage(null);
    setSupportError(null);
    setSavingIntent(null);
    setExpandingScope(null);
  }, [contextKey]);

  const hasDraft = draftState !== null && draftState !== undefined;
  const canViewPromptPreview = studioEnabled && access.canViewPrompts;
  const isQueuedBuild = !hasDraft && buildState?.status === "queued";
  const isGeneratingBuild =
    !hasDraft &&
    (buildState?.status === "generating" ||
      (state.status === "loading" && activeTrigger !== null && activeTrigger !== "manual"));
  const showAutoBuildState = isQueuedBuild || isGeneratingBuild;
  const showFailedBuildState = !hasDraft && buildState?.status === "failed";
  const buildErrorMessage =
    state.status === "error"
      ? state.message
      : showFailedBuildState
        ? buildState?.error ?? "The lesson draft build did not finish."
        : null;
  const lessonAutoBuildKey =
    buildState?.status === "queued"
      ? `${date}:${resolvedSlotId}:${buildState.routeFingerprint}:${buildState.queuedAt ?? buildState.updatedAt}`
      : null;
  const resolvedLessonLabel =
    slotLabel ?? (slotPosition ? `Lesson ${slotPosition}` : "Lesson");
  const lessonContextCopy =
    daySkillCount && daySkillCount > routeItemCount
      ? daySlotCount && daySlotCount > 1 && slotPosition
        ? `${resolvedLessonLabel} is ${slotPosition} of ${daySlotCount} scheduled lessons and covers ${routeItemCount} of ${daySkillCount} skills planned for today.`
        : `${resolvedLessonLabel} covers ${routeItemCount} of ${daySkillCount} skills planned for today.`
      : "Keep the mechanics here. The draft itself stays front and center.";

  async function requestDraft(
    trigger: "onboarding_auto" | "today_resume" | "manual",
    autoBuildKey?: string | null,
  ) {
    setActiveTrigger(trigger);
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/ai/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sourceId, slotId: resolvedSlotId, trigger }),
      });

      const data = (await response.json()) as
        | {
            structured: StructuredLessonDraft;
            lessonDraft?: DailyWorkspaceLessonDraft | null;
            lessonBuild?: DailyWorkspaceLessonBuild | null;
            activityBuild?: DailyWorkspaceActivityBuild | null;
            error?: string;
          }
        | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Lesson plan generation failed.");
      }

      if (!("structured" in data) || !data.structured) {
        throw new Error("Lesson plan generation failed.");
      }

      setState({ status: "ready", draft: data.structured });
      onLessonPatch?.({
        lessonDraft:
          data.lessonDraft ??
          ({
            structured: data.structured,
            sourceId: sourceId ?? "",
            sourceTitle,
            routeFingerprint,
            savedAt: new Date().toISOString(),
          } satisfies DailyWorkspaceLessonDraft),
        lessonBuild: data.lessonBuild ?? buildState ?? null,
        activityBuild: data.activityBuild,
      });
    } catch (error) {
      if (autoBuildKey) {
        releaseAutoBuildLock("today-lesson-auto", autoBuildKey);
      }

      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Lesson plan generation failed.",
      });
    }
  }

  function handleGenerate(trigger: "onboarding_auto" | "today_resume" | "manual" = "manual") {
    void requestDraft(trigger);
  }

  useEffect(() => {
    if (!lessonAutoBuildKey || !isQueuedBuild) {
      return;
    }

    if (!acquireAutoBuildLock("today-lesson-auto", lessonAutoBuildKey)) {
      return;
    }

    void requestDraft("onboarding_auto", lessonAutoBuildKey);
  }, [isQueuedBuild, lessonAutoBuildKey]);

  async function handlePromptPreview() {
    if (!canViewPromptPreview) {
      return;
    }

    openPanel(LESSON_PLAN_PROMPT_PANEL_ID);

    if (promptDebugState.status === "ready" || promptDebugState.status === "loading") {
      return;
    }

    setPromptDebugState({ status: "loading" });

    try {
      const response = await fetch("/api/ai/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sourceId, slotId: resolvedSlotId, debug: true }),
      });

      const data = (await response.json()) as
        | { debug: PromptDebugPreview; error?: string }
        | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Prompt preview failed.");
      }

      if (!("debug" in data)) {
        throw new Error("Prompt preview failed.");
      }

      setPromptDebugState({
        status: "ready",
        preview: data.debug,
      });
    } catch (error) {
      setPromptDebugState({
        status: "error",
        message: error instanceof Error ? error.message : "Prompt preview failed.",
      });
    }
  }

  async function handleExpansionIntent(intent: DailyWorkspaceExpansionIntent) {
    if (!sourceId) {
      setSupportError("No curriculum source is available for this lesson.");
      return;
    }

    setSupportError(null);
    setSupportMessage(null);
    setSavingIntent(intent);

    const saved = await saveExpansionIntentAction({
      date,
      sourceId,
      routeFingerprint,
      intent,
    });

    setSavingIntent(null);

    if (!saved.ok) {
      setSupportError(saved.error ?? "Could not save the expansion preference.");
      return;
    }

    setSupportMessage(saved.message ?? "Saved.");
    onExpansionIntentChange?.(saved.intent ?? intent);
  }

  async function handleRouteExpansion(scope: DailyWorkspaceExpansionScope) {
    if (!sourceId) {
      setSupportError("No curriculum source is available for this lesson.");
      return;
    }

    setSupportError(null);
    setSupportMessage(null);
    setExpandingScope(scope);

    const expanded = await expandTodayRouteAction({
      date,
      sourceId,
      scope,
    });

    setExpandingScope(null);

    if (!expanded.ok) {
      setSupportError(expanded.error ?? "Could not expand the route.");
      return;
    }

    setSupportMessage(expanded.message ?? "Saved.");
    onWorkspacePatch?.(expanded.workspacePatch);
  }

  function getExpansionButtonLabel(scope: DailyWorkspaceExpansionScope) {
    switch (scope) {
      case "tomorrow":
        return "Expand to tomorrow";
      case "next_few_days":
        return "Expand to next few days";
      case "current_week":
        return "Expand to current week";
    }
  }

  return (
    <>
      <Card className="quiet-panel">
        <div className="space-y-5 p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{resolvedLessonLabel}</Badge>
              <Badge variant="outline">
                {routeItemCount} skill{routeItemCount === 1 ? "" : "s"}
              </Badge>
              {daySkillCount && daySkillCount > routeItemCount ? (
                <Badge variant="outline">
                  {daySkillCount} skills today
                </Badge>
              ) : null}
              <Badge variant="outline">{totalMinutes} min</Badge>
              <Badge variant="outline">{objectiveCount} targets</Badge>
            </div>
            <div>
              <h2 className="font-serif text-2xl">Teach this lesson</h2>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">
                {lessonContextCopy}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:flex sm:flex-wrap">
            {!showAutoBuildState ? (
              <button
                type="button"
                onClick={() => handleGenerate(showFailedBuildState ? "today_resume" : "manual")}
                disabled={state.status === "loading" || routeItemCount === 0}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "min-h-11 w-full justify-center sm:min-h-8 sm:w-auto",
                )}
              >
                {state.status === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {hasDraft
                  ? "Regenerate"
                  : showFailedBuildState
                    ? "Retry build"
                    : "Generate"}
              </button>
            ) : null}

            {canViewPromptPreview ? (
              <button
                type="button"
                onClick={handlePromptPreview}
                disabled={routeItemCount === 0 || promptDebugState.status === "loading"}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "min-h-11 w-full justify-center sm:min-h-8 sm:w-auto",
                )}
              >
                {promptDebugState.status === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Prompt preview
              </button>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/70 bg-background/72 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Learner handoff</p>
              <p className="text-sm text-muted-foreground">
                Open or build the learner-facing activity without leaving today.
              </p>
            </div>
            <div className="mt-3">
              <LessonDraftActivityControl
                date={date}
                sourceId={sourceId}
                slotId={resolvedSlotId}
                routeFingerprint={routeFingerprint}
                activityState={activityState ?? null}
                sessionId={lessonSessionId}
                buildState={activityBuild ?? null}
                onActivityPatch={(patch) => onActivityPatch?.(patch)}
              />
            </div>
          </div>

          <details className="rounded-lg border border-border/70 bg-background/72 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Context
            </summary>
            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Route:</span>{" "}
                {routeItemTitles.length > 0 ? routeItemTitles.join(" · ") : "No route items"}
              </div>
              <div>
                <span className="font-medium text-foreground">Targets:</span>{" "}
                {objectives.length > 0 ? objectives.join(" · ") : "None"}
              </div>
            </div>
          </details>

          {buildErrorMessage ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {buildErrorMessage}
            </div>
          ) : null}

          {showDraftOutput && draftState?.kind === "structured" ? (
            <div className="rounded-lg border border-border/70 bg-background/72 p-4">
              <LessonDraftRenderer draft={draftState.draft} mode="compact" />
            </div>
          ) : showDraftOutput && draftState?.kind === "markdown" ? (
            <div className="rounded-lg border border-border/70 bg-background p-5">
              <LegacyLessonDraftNotice />
              <div className="mt-4">
                <MarkdownContent content={draftState.markdown} />
              </div>
            </div>
          ) : showDraftOutput && showAutoBuildState ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
              <div className="flex items-start gap-3">
                <Loader2 className="mt-0.5 size-4 animate-spin text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">
                    {isQueuedBuild
                      ? "Preparing your first lesson draft…"
                      : "Building today’s lesson draft…"}
                  </p>
                  <p className="text-muted-foreground">
                    Stay on this page. We&apos;re using the saved route and intake context to build
                    the first teachable day automatically.
                  </p>
                </div>
              </div>
            </div>
          ) : showDraftOutput && showFailedBuildState ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">The first lesson draft did not finish.</p>
              <p className="mt-1">
                Retry the build here. The bounded route is still saved and ready to use.
              </p>
            </div>
          ) : showDraftOutput && !hasDraft ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-background p-4 text-sm text-muted-foreground">
              Generate a draft when today’s route is set.
            </div>
          ) : null}

          <details className="rounded-lg border border-border/70 bg-background/72 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              More planning controls
            </summary>
            <div className="mt-3 space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Scope intent</p>
                  <p className="text-sm text-muted-foreground">
                    Record whether today should stay bounded or become the starting point for more route.
                  </p>
                </div>
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleExpansionIntent("keep_today")}
                    disabled={savingIntent !== null}
                    className={cn(
                      buttonVariants({
                        variant: expansionIntent === "keep_today" ? "default" : "outline",
                        size: "sm",
                      }),
                      "min-h-11 w-full justify-center sm:min-h-8 sm:w-auto",
                    )}
                  >
                    {savingIntent === "keep_today" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Keep this to today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExpansionIntent("expand_from_here")}
                    disabled={savingIntent !== null}
                    className={cn(
                      buttonVariants({
                        variant: expansionIntent === "expand_from_here" ? "default" : "outline",
                        size: "sm",
                      }),
                      "min-h-11 w-full justify-center sm:min-h-8 sm:w-auto",
                    )}
                  >
                    {savingIntent === "expand_from_here" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Expand from here
                  </button>
                </div>
              </div>

              {hasDraft ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Route expansion</p>
                    <p className="text-sm text-muted-foreground">
                      Schedule more of the saved route without replacing today&apos;s lesson.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:flex sm:flex-wrap">
                    {(["tomorrow", "next_few_days", "current_week"] as const).map((scope) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => handleRouteExpansion(scope)}
                        disabled={!sourceId || expandingScope !== null}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "min-h-11 w-full justify-center sm:min-h-8 sm:w-auto",
                        )}
                      >
                        {expandingScope === scope ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        {getExpansionButtonLabel(scope)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </details>

          {supportMessage ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
              {supportMessage}
            </div>
          ) : null}

          {supportError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {supportError}
            </div>
          ) : null}
        </div>
      </Card>

      <StudioDrawer
        panelId={LESSON_PLAN_PROMPT_PANEL_ID}
        title="Lesson prompt preview"
        description="Studio mode keeps prompt and artifact diagnostics available without pushing them into the default lesson flow."
      >
        {promptDebugState.status === "error" ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {promptDebugState.message}
          </div>
        ) : null}
        {promptDebugState.status === "loading" ? (
          <div className="text-sm text-muted-foreground">Building prompt preview...</div>
        ) : null}
        {promptDebugState.status === "ready" ? (
          <LearningCorePromptPreviewCard preview={promptDebugState.preview} />
        ) : null}
      </StudioDrawer>
    </>
  );
}
