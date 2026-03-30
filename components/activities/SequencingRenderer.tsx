"use client";

import * as React from "react";
import { GripVertical, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActivityShell } from "./ActivityShell";
import type { ActivityDefinition, AttemptAnswer } from "@/lib/activities/types";

type SequencingActivity = Extract<ActivityDefinition, { kind: "sequencing" }>;

interface Props {
  activity: SequencingActivity;
  initialAnswers?: AttemptAnswer[];
  onAnswerChange?: (answers: AttemptAnswer[]) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
  estimatedMinutes?: number;
}

export function SequencingRenderer({
  activity,
  initialAnswers = [],
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
  estimatedMinutes,
}: Props) {
  const initialOrder = React.useMemo(() => {
    if (initialAnswers.length > 0) {
      return initialAnswers
        .sort((a, b) => (a.value as number) - (b.value as number))
        .map((a) => activity.items.find((i) => i.id === a.questionId)!)
        .filter(Boolean);
    }
    return [...activity.items].sort(() => Math.random() - 0.5);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [items, setItems] = React.useState(initialOrder);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  function buildAnswers(ordered: typeof items): AttemptAnswer[] {
    return ordered.map((item, index) => ({
      questionId: item.id,
      value: index,
      correct: item.correctIndex === index,
    }));
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (!draggingId || draggingId === id) return;
    const from = items.findIndex((i) => i.id === draggingId);
    const to = items.findIndex((i) => i.id === id);
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    onAnswerChange?.(buildAnswers(next));
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  const allCorrect =
    submitted && items.every((item, idx) => item.correctIndex === idx);

  return (
    <ActivityShell
      title={activity.title}
      instructions={activity.instructions ?? "Drag the items into the correct order."}
      progress={submitted ? 1 : undefined}
      estimatedMinutes={estimatedMinutes}
      onSubmit={onSubmit ? () => onSubmit(buildAnswers(items)) : undefined}
      submitting={submitting}
      submitted={submitted}
    >
      {activity.prompt && (
        <p className="mb-4 text-sm text-muted-foreground">{activity.prompt}</p>
      )}
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => {
          const correct = submitted && item.correctIndex === idx;
          const wrong = submitted && item.correctIndex !== idx;
          return (
            <div
              key={item.id}
              draggable={!submitted}
              onDragStart={() => handleDragStart(item.id)}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                !submitted && "cursor-grab active:cursor-grabbing border-border bg-card/70 hover:bg-muted/60",
                draggingId === item.id && "opacity-50",
                correct && "border-emerald-400 bg-emerald-50",
                wrong && "border-red-400 bg-red-50"
              )}
            >
              {!submitted && (
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
              )}
              {submitted && correct && (
                <CheckCircle className="size-4 shrink-0 text-emerald-600" />
              )}
              {submitted && wrong && (
                <XCircle className="size-4 shrink-0 text-red-600" />
              )}
              <span className="flex-1">{item.text}</span>
              {submitted && wrong && (
                <span className="text-xs text-muted-foreground">
                  (correct position: {item.correctIndex + 1})
                </span>
              )}
            </div>
          );
        })}
      </div>
      {allCorrect && (
        <p className="mt-3 text-sm text-emerald-700 font-medium">Perfect order! Well done.</p>
      )}
    </ActivityShell>
  );
}
