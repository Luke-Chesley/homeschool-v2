"use client";

import { useId, useState } from "react";

import type { LessonBlock } from "@/lib/lesson-draft/types";
import { cn } from "@/lib/utils";

type LessonStepHelpResponse = {
  answer: string;
};

interface LessonBlockHelpProps {
  block: LessonBlock;
  blockIndex: number;
  lessonTitle: string;
  lessonFocus: string;
}

export function LessonBlockHelp({
  block,
  blockIndex,
  lessonTitle,
  lessonFocus,
}: LessonBlockHelpProps) {
  const helpPanelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadHelp() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/lesson-step-help", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lessonTitle,
          lessonFocus,
          blockIndex,
          block,
        }),
      });

      const data = (await response.json().catch(() => null)) as LessonStepHelpResponse | { error?: string } | null;

      if (!response.ok || !data || !("answer" in data) || typeof data.answer !== "string") {
        throw new Error(
          data && "error" in data && typeof data.error === "string"
            ? data.error
            : "Help is unavailable right now.",
        );
      }

      setAnswer(data.answer);
      setIsOpen(true);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Help is unavailable right now.");
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  }

  function handleToggle() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);

    if (!answer && !isLoading) {
      void loadHelp();
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border/50 bg-muted/12">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls={helpPanelId}
      >
        <span className="text-sm font-medium text-foreground">I need more help</span>
        <span className="text-xs text-muted-foreground">
          {isLoading ? "Loading..." : isOpen ? "Hide" : "Show"}
        </span>
      </button>

      {isOpen ? (
        <div id={helpPanelId} className="border-t border-border/50 px-3 py-3">
          {answer ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{answer}</p>
          ) : null}

          {error ? (
            <div className="space-y-2">
              <p className="text-sm leading-6 text-destructive">{error}</p>
              <button
                type="button"
                className={cn(
                  "text-xs font-medium text-foreground underline underline-offset-4",
                  isLoading && "pointer-events-none opacity-60",
                )}
                onClick={() => void loadHelp()}
                disabled={isLoading}
              >
                Try again
              </button>
            </div>
          ) : null}

          {isLoading && !answer ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Writing step-specific guidance for this block...
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
