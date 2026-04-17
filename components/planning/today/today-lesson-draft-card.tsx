"use client";

import dynamic from "next/dynamic";

import { Card } from "@/components/ui/card";
import type { TodayPlanItemEvaluationResult } from "@/app/(parent)/today/actions";
import type { DailyWorkspace } from "@/lib/planning/types";

import type { DraftState } from "./types";

const DeferredTodayLessonDraftArticle = dynamic(
  () =>
    import("./lesson-draft-article").then(
      (module) => module.TodayLessonDraftArticle,
    ),
  {
    loading: () => (
      <Card className="reading-surface">
        <div className="space-y-4 p-6">
          <div className="h-6 w-40 rounded bg-muted/70" />
          <div className="h-24 rounded bg-muted/50" />
          <div className="h-32 rounded bg-muted/40" />
        </div>
      </Card>
    ),
  },
);

export function TodayLessonDraftCard({
  workspace,
  draftState,
  onEvaluationSaved,
}: {
  workspace: DailyWorkspace;
  draftState: DraftState & { kind: string };
  onEvaluationSaved: (result: TodayPlanItemEvaluationResult) => void;
}) {
  return (
    <DeferredTodayLessonDraftArticle
      workspace={workspace}
      draftState={draftState}
      onEvaluationSaved={onEvaluationSaved}
    />
  );
}
