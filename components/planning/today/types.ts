"use client";

import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import type { DailyWorkspace, DailyWorkspaceLessonDraft } from "@/lib/planning/types";

export type DraftState =
  | { kind: "structured"; draft: StructuredLessonDraft }
  | { kind: "markdown"; markdown: string }
  | null;

export function initialDraftState(lessonDraft: DailyWorkspaceLessonDraft | null): DraftState {
  if (!lessonDraft) {
    return null;
  }

  if (lessonDraft.structured) {
    return { kind: "structured", draft: lessonDraft.structured };
  }

  if (lessonDraft.markdown) {
    return { kind: "markdown", markdown: lessonDraft.markdown };
  }

  return null;
}

export function formatMinutes(minutes: number) {
  return `${minutes} min`;
}

export function formatPlannerDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function getStatusLabel(status: string) {
  return status.replace("_", " ");
}

export function getReviewLabel(reviewState?: string | null) {
  if (!reviewState || reviewState === "not_required") {
    return null;
  }

  return reviewState.replaceAll("_", " ");
}

export function canRepeatToTomorrow(date: string) {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 4;
}

export function getCompletionDisplay(
  item: DailyWorkspace["items"][number],
  feedbackMessage?: string | null,
) {
  if (feedbackMessage) {
    return feedbackMessage;
  }

  if (item.completionStatus === "completed_as_planned") {
    return "Confirmed done and saved to today's record.";
  }

  if (item.completionStatus === "partially_completed") {
    return "Marked partial and carried forward.";
  }

  if (item.completionStatus === "skipped") {
    return "Skipped today and recorded.";
  }

  return null;
}
