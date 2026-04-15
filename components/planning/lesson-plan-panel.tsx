"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { LearningCorePromptPreviewCard } from "@/components/debug/LearningCorePromptPreviewCard";
import { useStudio } from "@/components/studio/studio-provider";
import { StudioDrawer } from "@/components/studio/StudioDrawer";
import {
  LessonDraftRenderer,
  LegacyLessonDraftNotice,
} from "@/components/planning/lesson-draft-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import type { DailyWorkspaceLessonBuild } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

const LESSON_PLAN_PROMPT_PANEL_ID = "lesson-plan-prompt-preview";

// DraftState mirrors the type in today-workspace-view without a cross-import
type DraftState =
  | { kind: "structured"; draft: StructuredLessonDraft }
  | { kind: "markdown"; markdown: string }
  | null;

interface LessonPlanPanelProps {
  date: string;
  sourceId?: string;
  sourceTitle: string;
  routeItemCount: number;
  totalMinutes: number;
  objectiveCount: number;
  objectives: string[];
  routeItemTitles: string[];
  draftState?: DraftState;
  buildState?: DailyWorkspaceLessonBuild | null;
  onDraftChange?: (draft: StructuredLessonDraft | string | null) => void;
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
  sourceTitle,
  routeItemCount,
  totalMinutes,
  objectiveCount,
  objectives,
  routeItemTitles,
  draftState,
  buildState,
  onDraftChange,
  showDraftOutput = true,
}: LessonPlanPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<LessonPlanState>({ status: "idle" });
  const [promptDebugState, setPromptDebugState] = useState<PromptDebugState>({ status: "idle" });
  const [activeTrigger, setActiveTrigger] = useState<
    "onboarding_auto" | "today_resume" | "manual" | null
  >(null);
  const [autoBuildStarted, setAutoBuildStarted] = useState(false);
  const { access, isEnabled: studioEnabled, openPanel } = useStudio();
  const contextKey = useMemo(
    () =>
      JSON.stringify({
        date,
        sourceId,
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
    setAutoBuildStarted(false);
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

  async function requestDraft(trigger: "onboarding_auto" | "today_resume" | "manual") {
    setActiveTrigger(trigger);
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/ai/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sourceId, trigger }),
      });

      const data = (await response.json()) as
        | { structured: StructuredLessonDraft; error?: string }
        | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Lesson plan generation failed.");
      }

      if (!("structured" in data) || !data.structured) {
        throw new Error("Lesson plan generation failed.");
      }

      setState({ status: "ready", draft: data.structured });
      onDraftChange?.(data.structured);
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Lesson plan generation failed.",
      });
      router.refresh();
    }
  }

  function handleGenerate(trigger: "onboarding_auto" | "today_resume" | "manual" = "manual") {
    void requestDraft(trigger);
  }

  useEffect(() => {
    if (!isQueuedBuild || autoBuildStarted) {
      return;
    }

    setAutoBuildStarted(true);
    void requestDraft("onboarding_auto");
  }, [autoBuildStarted, isQueuedBuild]);

  useEffect(() => {
    if (!hasDraft && buildState?.status === "generating" && state.status !== "loading") {
      const timeout = window.setTimeout(() => {
        router.refresh();
      }, 2000);

      return () => window.clearTimeout(timeout);
    }

    return undefined;
  }, [buildState?.status, buildState?.updatedAt, hasDraft, router, state.status]);

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
        body: JSON.stringify({ date, sourceId, debug: true }),
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

  return (
    <>
      <Card className="quiet-panel">
        <div className="space-y-5 p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{routeItemCount} items</Badge>
              <Badge variant="outline">{totalMinutes} min</Badge>
              <Badge variant="outline">{objectiveCount} targets</Badge>
            </div>
            <div>
              <h2 className="font-serif text-2xl">Lesson draft</h2>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">{sourceTitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!showAutoBuildState ? (
              <button
                type="button"
                onClick={() => handleGenerate(showFailedBuildState ? "today_resume" : "manual")}
                disabled={state.status === "loading" || routeItemCount === 0}
                className={cn(buttonVariants({ variant: "default", size: "sm" }))}
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
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {promptDebugState.status === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Prompt preview
              </button>
            ) : null}
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
