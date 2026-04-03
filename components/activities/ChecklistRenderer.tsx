"use client";

import * as React from "react";

import { ActivityShell } from "./ActivityShell";
import type { ActivityDefinition, AttemptAnswer } from "@/lib/activities/types";

type ChecklistActivity = Extract<ActivityDefinition, { kind: "checklist" }>;

interface Props {
  activity: ChecklistActivity;
  initialAnswers?: AttemptAnswer[];
  onAnswerChange?: (answers: AttemptAnswer[]) => void;
  onSubmit?: (answers: AttemptAnswer[]) => void;
  submitting?: boolean;
  submitted?: boolean;
  estimatedMinutes?: number;
}

function readCheckedAnswers(initialAnswers: AttemptAnswer[], itemIds: string[]) {
  const checked = new Set(
    initialAnswers
      .filter((answer) => answer.value === true)
      .map((answer) => answer.questionId),
  );

  return itemIds.reduce<Record<string, boolean>>((acc, itemId) => {
    acc[itemId] = checked.has(itemId);
    return acc;
  }, {});
}

export function ChecklistRenderer({
  activity,
  initialAnswers = [],
  onAnswerChange,
  onSubmit,
  submitting,
  submitted,
  estimatedMinutes,
}: Props) {
  const itemIds = activity.items.map((item) => item.id);
  const [checkedItems, setCheckedItems] = React.useState<Record<string, boolean>>(
    () => readCheckedAnswers(initialAnswers, itemIds),
  );

  React.useEffect(() => {
    setCheckedItems(readCheckedAnswers(initialAnswers, itemIds));
  }, [activity.items, initialAnswers]);

  function emit(nextChecked: Record<string, boolean>) {
    const answers = activity.items.map((item) => ({
      questionId: item.id,
      value: Boolean(nextChecked[item.id]),
      correct: item.required !== false ? Boolean(nextChecked[item.id]) : undefined,
    }));
    onAnswerChange?.(answers);
    return answers;
  }

  function toggleItem(itemId: string) {
    const next = { ...checkedItems, [itemId]: !checkedItems[itemId] };
    setCheckedItems(next);
    emit(next);
  }

  const completedCount = activity.items.filter((item) => checkedItems[item.id]).length;
  const progress = activity.items.length > 0 ? completedCount / activity.items.length : 0;
  const canSubmit =
    activity.allowPartialSubmit || activity.items.every((item) => checkedItems[item.id]);

  return (
    <ActivityShell
      title={activity.title}
      instructions={activity.instructions ?? "Check off each item as you complete it."}
      progress={submitted ? 1 : progress}
      estimatedMinutes={estimatedMinutes}
      onSubmit={onSubmit ? () => onSubmit(emit(checkedItems)) : undefined}
      submitDisabled={!canSubmit}
      submitting={submitting}
      submitted={submitted}
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">{activity.title}</legend>
        {activity.items.map((item, index) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 text-sm transition-colors hover:bg-muted/40"
          >
            <input
              type="checkbox"
              checked={Boolean(checkedItems[item.id])}
              onChange={() => toggleItem(item.id)}
              className="mt-1 size-4 rounded border-border text-primary focus:ring-ring"
              aria-describedby={item.description ? `${item.id}-description` : undefined}
              disabled={submitted}
            />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <span className="font-medium text-foreground">{item.label}</span>
              </div>
              {item.description ? (
                <p id={`${item.id}-description`} className="text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
          </label>
        ))}
      </fieldset>

      {!canSubmit ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Finish every required item before submitting.
        </p>
      ) : null}
    </ActivityShell>
  );
}
