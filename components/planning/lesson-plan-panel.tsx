"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";

interface LessonPlanPanelProps {
  date: string;
  sourceId?: string;
  sourceTitle: string;
  routeItemCount: number;
  totalMinutes: number;
  objectiveCount: number;
  objectives: string[];
  routeItemTitles: string[];
}

type LessonPlanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; markdown: string }
  | { status: "error"; message: string };

type PromptDebugState =
  | { status: "idle"; open: false }
  | { status: "loading"; open: true }
  | { status: "ready"; open: true; systemPrompt: string; userPrompt: string }
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

  const buttonLabel =
    state.status === "ready" ? "Regenerate lesson plan" : "Generate lesson plan";

  async function handleGenerate() {
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/ai/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          sourceId,
        }),
      });

      const data = (await response.json()) as
        | { markdown: string; error?: string }
        | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Lesson plan generation failed.");
      }

      if (!("markdown" in data)) {
        throw new Error("Lesson plan generation failed.");
      }

      setState({ status: "ready", markdown: data.markdown });
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
        body: JSON.stringify({
          date,
          sourceId,
          debug: true,
        }),
      });

      const data = (await response.json()) as
        | { debug: { systemPrompt: string; userPrompt: string }; error?: string }
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
        systemPrompt: data.debug.systemPrompt,
        userPrompt: data.debug.userPrompt,
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
    <Card className="border-border/70 bg-card/88 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{routeItemCount} items</Badge>
          <Badge variant="secondary">{totalMinutes} min</Badge>
          <Badge variant="outline">{objectiveCount} objectives</Badge>
        </div>
        <CardDescription>Lesson plan generation</CardDescription>
        <CardTitle className="font-serif text-2xl leading-tight">
          Draft from today&apos;s objectives and this week&apos;s route
        </CardTitle>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
          Uses the current route items, daily objectives, and weekly planning context to generate a lesson plan you can teach from directly on this page.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <details className="rounded-3xl border border-border/70 bg-background/65 px-4 py-3">
            <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
              Prompt context
            </summary>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">Source:</span> {sourceTitle}
              </div>
              <div>
                <span className="font-semibold text-foreground">Route items:</span>{" "}
                {routeItemTitles.length > 0 ? routeItemTitles.join(" · ") : "No route items"}
              </div>
              <div>
                <span className="font-semibold text-foreground">Objectives:</span>{" "}
                {objectives.length > 0 ? objectives.join(" · ") : "None captured"}
              </div>
            </div>
          </details>

          <div className="rounded-3xl border border-border/70 bg-background/65 px-4 py-3">
            <p className="text-sm font-medium text-foreground">What changes now</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The generated draft renders as markdown in the main flow, so the page can read like a real lesson plan instead of raw model text.
            </p>
          </div>
        </div>

        <div className="relative flex flex-wrap items-start gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={state.status === "loading" || routeItemCount === 0}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full sm:w-auto")}
          >
            {state.status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {buttonLabel}
          </button>

          <button
            type="button"
            onClick={handlePromptPreview}
            disabled={routeItemCount === 0 || promptDebugState.status === "loading"}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto")}
          >
            {promptDebugState.status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {promptDebugState.open ? "Hide prompt" : "View prompt"}
          </button>

          {promptDebugState.open ? (
            <div className="z-10 w-full rounded-3xl border border-border/70 bg-background/98 p-4 shadow-lg sm:absolute sm:top-11 sm:right-0 sm:max-w-3xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Prompt preview</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Exact system and user prompt content for the current lesson-plan request.
                  </p>
                </div>
              </div>

              {promptDebugState.status === "error" ? (
                <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {promptDebugState.message}
                </div>
              ) : null}

              {promptDebugState.status === "loading" ? (
                <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
                  Building prompt preview...
                </div>
              ) : null}

              {promptDebugState.status === "ready" ? (
                <div className="mt-4 grid gap-4">
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                    <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      System prompt
                    </p>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-foreground">
                      {promptDebugState.systemPrompt}
                    </pre>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                    <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      User prompt
                    </p>
                    <pre className="mt-2 max-h-[26rem] overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-foreground">
                      {promptDebugState.userPrompt}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {state.status === "error" ? (
          <div className="rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm leading-7 text-destructive">
            {state.message}
          </div>
        ) : null}

        {state.status === "ready" ? (
          <div className="rounded-3xl border border-border/70 bg-background/75 p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Generated lesson plan
            </p>
            <MarkdownContent content={state.markdown} className="mt-4" />
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border/70 bg-background/50 p-4 text-sm leading-7 text-muted-foreground">
            The lesson plan will render here after you generate it.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
