"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  TodayPlanItemActionResult,
  TodayPlanItemEvaluationResult,
  TodayWorkspacePatch,
} from "@/app/(parent)/today/actions";
import type {
  DailyWorkspace,
  DailyWorkspaceActivityState,
  DailyWorkspaceLessonBuild,
  DailyWorkspaceLessonDraft,
} from "@/lib/planning/types";

import { TodayLearnerActivityBridge } from "./activity-build-control";
import { TodayLessonDraftCard } from "./today-lesson-draft-card";
import {
  TodayLessonPlanSection,
  TodayRouteItemsSection,
} from "./route-section-shells";
import type { DraftState } from "./types";

export function TodayWorkspaceShell({
  workspace,
  sourceId,
  routeFingerprint,
  draftState,
  repeatTomorrowAllowed,
  onItemActionSaved,
  onEvaluationSaved,
  onLessonPatch,
  onActivityPatch,
  onRegenerationNoteChange,
  onExpansionIntentChange,
  onWorkspacePatch,
}: {
  workspace: DailyWorkspace;
  sourceId?: string;
  routeFingerprint: string;
  draftState: DraftState;
  repeatTomorrowAllowed: boolean;
  onItemActionSaved: (result: TodayPlanItemActionResult) => void;
  onEvaluationSaved: (result: TodayPlanItemEvaluationResult) => void;
  onLessonPatch: (patch: {
    lessonDraft?: DailyWorkspaceLessonDraft | null;
    lessonBuild?: DailyWorkspaceLessonBuild | null;
    activityBuild?: DailyWorkspace["activityBuild"] | null;
  }) => void;
  onActivityPatch: (patch: {
    activityBuild?: DailyWorkspace["activityBuild"] | null;
    activityState?: DailyWorkspaceActivityState | null;
  }) => void;
  onRegenerationNoteChange: (note: string | null) => void;
  onExpansionIntentChange: (intent: DailyWorkspace["expansionIntent"]) => void;
  onWorkspacePatch: (patch?: TodayWorkspacePatch) => void;
}) {
  if (workspace.items.length === 0) {
    return (
      <Card className="quiet-panel max-w-4xl border-dashed">
        <div className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="mt-1 font-serif text-2xl">Nothing is queued for today.</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            No route items are ready for {workspace.learner.name} today. Open curriculum or planning
            to shape the next workable day.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/curriculum" className={buttonVariants({ variant: "default", size: "sm" })}>
              Open curriculum
            </Link>
            <Link href="/planning" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open planning
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  if (draftState) {
    return (
      <div className="space-y-6">
        <TodayLearnerActivityBridge
          workspace={workspace}
          draftState={draftState}
          sourceId={sourceId}
          routeFingerprint={routeFingerprint}
          onActivityPatch={onActivityPatch}
        />
        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_20rem] xl:items-start">
          <TodayRouteItemsSection
            workspace={workspace}
            repeatTomorrowAllowed={repeatTomorrowAllowed}
            compact
            onActionSaved={onItemActionSaved}
            onEvaluationSaved={onEvaluationSaved}
          />
          <TodayLessonDraftCard
            workspace={workspace}
            draftState={draftState}
            onEvaluationSaved={onEvaluationSaved}
          />
          <TodayLessonPlanSection
            workspace={workspace}
            sourceId={sourceId}
            routeFingerprint={routeFingerprint}
            draftState={draftState}
            buildState={workspace.lessonBuild}
            onLessonPatch={onLessonPatch}
            onRegenerationNoteChange={onRegenerationNoteChange}
            onExpansionIntentChange={onExpansionIntentChange}
            onWorkspacePatch={onWorkspacePatch}
            showDraftOutput={false}
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TodayLearnerActivityBridge
        workspace={workspace}
        draftState={draftState}
        sourceId={sourceId}
        routeFingerprint={routeFingerprint}
        onActivityPatch={onActivityPatch}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)] xl:items-start">
        <TodayRouteItemsSection
          workspace={workspace}
          repeatTomorrowAllowed={repeatTomorrowAllowed}
          onActionSaved={onItemActionSaved}
          onEvaluationSaved={onEvaluationSaved}
        />
        <TodayLessonPlanSection
          workspace={workspace}
          sourceId={sourceId}
          routeFingerprint={routeFingerprint}
          draftState={null}
          buildState={workspace.lessonBuild}
          onLessonPatch={onLessonPatch}
          onRegenerationNoteChange={onRegenerationNoteChange}
          onExpansionIntentChange={onExpansionIntentChange}
          onWorkspacePatch={onWorkspacePatch}
        />
      </div>
    </div>
  );
}
