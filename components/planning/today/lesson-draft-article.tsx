"use client";

import {
  LessonDraftRenderer,
  LegacyLessonDraftNotice,
} from "@/components/planning/lesson-draft-renderer";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { DailyWorkspace } from "@/lib/planning/types";
import { saveTodayPlanItemEvaluationAction } from "@/app/(parent)/today/actions";

import { LessonDraftOutcomeControl } from "./evaluation-control";
import type { DraftState } from "./types";

export function TodayLessonDraftArticle({
  workspace,
  draftState,
  onEvaluationSaved,
}: {
  workspace: DailyWorkspace;
  draftState: DraftState & { kind: string };
  onEvaluationSaved: (result: Awaited<ReturnType<typeof saveTodayPlanItemEvaluationAction>>) => void;
}) {
  const draftContent =
    draftState.kind === "structured" ? (
      <LessonDraftRenderer
        draft={draftState.draft}
        renderBlockFooter={(_block, index) => (
          <LessonDraftOutcomeControl
            item={workspace.leadItem}
            date={workspace.date}
            onEvaluationSaved={onEvaluationSaved}
            key={`${workspace.leadItem.id}-${index}`}
          />
        )}
      />
    ) : draftState.kind === "markdown" ? (
      <div className="space-y-4">
        <LegacyLessonDraftNotice />
        <MarkdownContent content={draftState.markdown} />
      </div>
    ) : null;

  return (
    <section className="space-y-4">
      <details className="group rounded-[var(--radius)] border border-border/70 bg-card md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground">
          <span>Open full lesson draft</span>
          <span className="text-xs text-muted-foreground transition group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-border/70 px-4 py-4">
          <div className="reading-column">{draftContent}</div>
        </div>
      </details>

      <Card className="reading-surface hidden md:block">
        <div className="reading-column">{draftContent}</div>
      </Card>
    </section>
  );
}
