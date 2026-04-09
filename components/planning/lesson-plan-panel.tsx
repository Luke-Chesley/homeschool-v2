"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { LearningCorePromptPreviewCard } from "@/components/debug/LearningCorePromptPreviewCard";
import {
  LessonDraftRenderer,
  LegacyLessonDraftNotice,
} from "@/components/planning/lesson-draft-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import { cn } from "@/lib/utils";

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
  onDraftChange?: (draft: StructuredLessonDraft | string | null) => void;
  showDraftOutput?: boolean;
}

type LessonPlanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; draft: StructuredLessonDraft }
  | { status: "error"; message: string };

type PromptDebugState =
  | { status: "idle"; open: false }
  | { status: "loading"; open: true }
  | {
      status: "ready";
      open: true;
      preview: {
        operation_name: string;
        skill_name: string;
        skill_version: string;
        request_id: string;
        allowed_tools: string[];
        system_prompt: string;
        user_prompt: string;
        request_envelope: unknown;
      };
    }
  | { status: "error"; open: true; message: string };

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
  onDraftChange,
  showDraftOutput = true,
}: LessonPlanPanelProps) {
  const [state, setState] = useState<LessonPlanState>({ status: "idle" });
  const [promptDebugState, setPromptDebugState] = useState<PromptDebugState>({
    status: "idle",
    open: false,
  });
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
    setPromptDebugState({ status: "idle", open: false });
  }, [contextKey]);

  const hasDraft = draftState !== null && draftState !== undefined;

  async function handleGenerate() {
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/ai/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sourceId }),
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
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Lesson plan generation failed.",
      });
    }
  }

  async function handlePromptPreview() {
    if (promptDebugState.open && promptDebugState.status !== "loading") {
      setPromptDebugState({ status: "idle", open: false });
      return;
    }

    setPromptDebugState({ status: "loading", open: true });

    try {
      const response = await fetch("/api/ai/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sourceId, debug: true }),
      });

      const data = (await response.json()) as
        | {
            debug: {
              operation_name: string;
              skill_name: string;
              skill_version: string;
              request_id: string;
              allowed_tools: string[];
              system_prompt: string;
              user_prompt: string;
              request_envelope: unknown;
            };
            error?: string;
          }
        | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Prompt preview failed.");
      }

      if (!("debug" in data)) {
        throw new Error("Prompt preview failed.");
      }

      setPromptDebugState({
        status: "ready",
        open: true,
        preview: data.debug,
      });
    } catch (error) {
      setPromptDebugState({
        status: "error",
        open: true,
        message: error instanceof Error ? error.message : "Prompt preview failed.",
      });
    }
  }

  return (
    <Card>
      <div className="space-y-5 p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{routeItemCount} items</Badge>
            <Badge variant="outline">{totalMinutes} min</Badge>
            <Badge variant="outline">{objectiveCount} targets</Badge>
          </div>
          <div>
            <h2 className="font-serif text-2xl">Lesson draft</h2>
            <p className="mt-1 text-sm text-muted-foreground">{sourceTitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={state.status === "loading" || routeItemCount === 0}
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            {state.status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {hasDraft ? "Regenerate" : "Generate"}
          </button>

          <button
            type="button"
            onClick={handlePromptPreview}
            disabled={routeItemCount === 0 || promptDebugState.status === "loading"}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {promptDebugState.status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {promptDebugState.open ? "Hide prompt" : "View prompt"}
          </button>
        </div>

        <details className="rounded-lg border border-border/70 bg-background px-4 py-3">
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

        {promptDebugState.open ? (
          <div className="rounded-lg border border-border/70 bg-background p-4">
            {promptDebugState.status === "error" ? (
              <div className="text-sm text-destructive">{promptDebugState.message}</div>
            ) : null}
            {promptDebugState.status === "loading" ? (
              <div className="text-sm text-muted-foreground">Building prompt preview...</div>
            ) : null}
            {promptDebugState.status === "ready" ? (
              <div className="grid gap-4">
                <LearningCorePromptPreviewCard preview={promptDebugState.preview} />
              </div>
            ) : null}
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {state.message}
          </div>
        ) : null}

        {showDraftOutput && draftState?.kind === "structured" ? (
          <div className="rounded-lg border border-border/70 bg-background p-4">
            <LessonDraftRenderer draft={draftState.draft} mode="compact" />
          </div>
        ) : showDraftOutput && draftState?.kind === "markdown" ? (
          <div className="rounded-lg border border-border/70 bg-background p-5">
            <LegacyLessonDraftNotice />
            <div className="mt-4">
              <MarkdownContent content={draftState.markdown} />
            </div>
          </div>
        ) : showDraftOutput && !hasDraft ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-background p-4 text-sm text-muted-foreground">
            Generate a draft when today’s route is set.
          </div>
        ) : null}
      </div>
    </Card>
  );
}
