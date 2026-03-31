"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LessonPlanPanelProps {
  date: string;
  sourceId?: string;
  sourceTitle: string;
  routeItemCount: number;
  totalMinutes: number;
  objectiveCount: number;
  leadItemTitle: string;
  leadItemObjective: string;
  objectives: string[];
}

type LessonPlanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; markdown: string }
  | { status: "error"; message: string };

export function LessonPlanPanel({
  date,
  sourceId,
  sourceTitle,
  routeItemCount,
  totalMinutes,
  objectiveCount,
  leadItemTitle,
  leadItemObjective,
  objectives,
}: LessonPlanPanelProps) {
  const [state, setState] = useState<LessonPlanState>({ status: "idle" });

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

  return (
    <Card className="border-border/70 bg-card/88">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{routeItemCount} items</Badge>
          <Badge variant="secondary">{totalMinutes} min</Badge>
          <Badge variant="outline">{objectiveCount} objectives</Badge>
        </div>
        <CardDescription>LLM lesson plan</CardDescription>
        <CardTitle className="font-serif text-2xl leading-tight">Draft from the current route</CardTitle>
        <p className="text-sm leading-7 text-muted-foreground">
          This uses the current route items, time budget, and objectives to generate a teachable plan.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-3xl border border-border/70 bg-background/75 p-4 text-sm leading-7 text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground">Source:</span> {sourceTitle}
          </div>
          <div>
            <span className="font-semibold text-foreground">Lead item:</span> {leadItemTitle}
          </div>
          <div>
            <span className="font-semibold text-foreground">Lead objective:</span> {leadItemObjective}
          </div>
          <div>
            <span className="font-semibold text-foreground">Objectives in scope:</span>{" "}
            {objectives.length > 0 ? objectives.join(" · ") : "None captured"}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={state.status === "loading" || routeItemCount === 0}
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full")}
        >
          {state.status === "loading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {buttonLabel}
        </button>

        {state.status === "error" ? (
          <div className="rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm leading-7 text-destructive">
            {state.message}
          </div>
        ) : null}

        {state.status === "ready" ? (
          <div className="rounded-3xl border border-border/70 bg-background/75 p-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Generated lesson plan
            </p>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">
              {state.markdown}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border/70 bg-background/50 p-4 text-sm leading-7 text-muted-foreground">
            The draft will appear here after you generate it.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
