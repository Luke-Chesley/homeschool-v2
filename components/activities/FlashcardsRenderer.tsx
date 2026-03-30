"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActivityShell } from "./ActivityShell";
import type { ActivityDefinition, AttemptAnswer } from "@/lib/activities/types";

type FlashcardsActivity = Extract<ActivityDefinition, { kind: "flashcards" }>;

interface Props {
  activity: FlashcardsActivity;
  initialAnswers?: AttemptAnswer[];
  onAnswerChange?: (answers: AttemptAnswer[], uiState: Record<string, unknown>) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
  estimatedMinutes?: number;
  initialUiState?: Record<string, unknown>;
}

export function FlashcardsRenderer({
  activity,
  initialAnswers = [],
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
  estimatedMinutes,
  initialUiState,
}: Props) {
  const cards = React.useMemo(() => {
    if (activity.randomize) {
      return [...activity.cards].sort(() => Math.random() - 0.5);
    }
    return activity.cards;
  }, [activity.cards, activity.randomize]);

  const [index, setIndex] = React.useState(
    typeof initialUiState?.cardIndex === "number" ? initialUiState.cardIndex : 0
  );
  const [flipped, setFlipped] = React.useState(false);
  const [seen, setSeen] = React.useState<Set<string>>(
    new Set(initialAnswers.map((a) => a.questionId))
  );

  const card = cards[index];

  function goNext() {
    setFlipped(false);
    const nextIndex = Math.min(index + 1, cards.length - 1);
    setIndex(nextIndex);
    const uiState = { cardIndex: nextIndex };
    onAnswerChange?.([...seen].map((id) => ({ questionId: id, value: "seen" })), uiState);
  }

  function goPrev() {
    setFlipped(false);
    const prevIndex = Math.max(index - 1, 0);
    setIndex(prevIndex);
  }

  function handleFlip() {
    setFlipped((v) => !v);
    if (!seen.has(card.id)) {
      const nextSeen = new Set(seen).add(card.id);
      setSeen(nextSeen);
      const answers = [...nextSeen].map((id) => ({ questionId: id, value: "seen" }));
      onAnswerChange?.(answers, { cardIndex: index });
    }
  }

  const progress = seen.size / cards.length;

  return (
    <ActivityShell
      title={activity.title}
      instructions={activity.instructions}
      progress={submitted ? 1 : progress}
      estimatedMinutes={estimatedMinutes}
      onSubmit={onSubmit ? () => onSubmit([...seen].map((id) => ({ questionId: id, value: "seen" }))) : undefined}
      submitting={submitting}
      submitted={submitted}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Card counter */}
        <p className="text-sm text-muted-foreground">
          Card {index + 1} of {cards.length}
        </p>

        {/* Flashcard */}
        <button
          type="button"
          onClick={handleFlip}
          className="group relative h-52 w-full max-w-md rounded-2xl border border-border/70 bg-card/80 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          aria-label={flipped ? "Show front" : "Show back (flip)"}
        >
          <div
            className={cn(
              "flex h-full flex-col items-center justify-center gap-2 p-6 transition-opacity duration-150",
              flipped ? "opacity-0 absolute inset-0" : "opacity-100"
            )}
          >
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Front</span>
            <p className="text-center text-lg font-medium">{card.front.text}</p>
          </div>
          <div
            className={cn(
              "flex h-full flex-col items-center justify-center gap-2 p-6 transition-opacity duration-150",
              flipped ? "opacity-100" : "opacity-0 absolute inset-0"
            )}
          >
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Back</span>
            <p className="text-center text-sm leading-relaxed text-foreground/90">{card.back.text}</p>
          </div>
        </button>

        <p className="text-xs text-muted-foreground">Click card to flip</p>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={goPrev}
            disabled={index === 0}
            aria-label="Previous card"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIndex(0);
              setFlipped(false);
            }}
            aria-label="Restart deck"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goNext}
            disabled={index === cards.length - 1}
            aria-label="Next card"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </ActivityShell>
  );
}
