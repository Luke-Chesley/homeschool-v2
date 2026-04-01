/**
 * Copilot page — parent workspace AI assistant.
 *
 * Full-height chat interface with context sidebar.
 * Context can be prefilled from query params (learnerId, lessonId, etc.)
 * to enable contextual AI interactions from other parts of the workspace.
 */

import * as React from "react";
import { Sparkles } from "lucide-react";
import { CopilotChat } from "@/components/copilot/CopilotChat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listCurriculumSources } from "@/lib/curriculum/service";
import { getAiRoutingConfig } from "@/lib/ai/routing";
import { requireAppSession } from "@/lib/app-session/server";
import { buildCopilotPlanningContext } from "@/lib/planning/copilot-snapshot";
import { getOrCreateWeeklyRouteBoardForLearner } from "@/lib/planning/weekly-route-service";
import { toWeekStartDate } from "@/lib/curriculum-routing";

export const metadata = {
  title: "Copilot",
};

interface Props {
  searchParams: Promise<{
    learnerId?: string;
    learnerName?: string;
    lessonId?: string;
    sourceId?: string;
    date?: string;
  }>;
}

export default async function CopilotPage({ searchParams }: Props) {
  const session = await requireAppSession();
  const params = await searchParams;
  const sources = await listCurriculumSources(session.organization.id);
  const routing = getAiRoutingConfig();
  const activeChatModel = routing.taskDefaults["chat.answer"] ?? routing.fallbackModel;

  const selectedSourceId =
    params.sourceId && sources.some((source) => source.id === params.sourceId)
      ? params.sourceId
      : sources[0]?.id;
  const selectedWeekStartDate = toWeekStartDate(params.date);
  const planningContext =
    selectedSourceId != null
      ? await getOrCreateWeeklyRouteBoardForLearner({
          learnerId: session.activeLearner.id,
          sourceId: selectedSourceId,
          weekStartDate: selectedWeekStartDate,
        })
      : null;
  const snapshot = planningContext
    ? buildCopilotPlanningContext({
        board: planningContext.board,
        learnerId: session.activeLearner.id,
        learnerName: session.activeLearner.displayName,
        sourceId: selectedSourceId,
        selectedDate: params.date,
      })
    : null;

  const context = {
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    curriculumSourceId: selectedSourceId,
    lessonId: params.lessonId,
    standardIds: [],
    goalIds: [],
    curriculumSnapshot: snapshot?.curriculumSnapshot,
    dailyWorkspaceSnapshot: snapshot?.dailyWorkspaceSnapshot,
    weeklyPlanningSnapshot: snapshot?.weeklyPlanningSnapshot,
    feedbackNotes: snapshot?.feedbackNotes ?? [],
    recentOutcomes: [],
  };

  const hasContext = Boolean(
    context.learnerId ||
      context.curriculumSourceId ||
      context.lessonId ||
      context.dailyWorkspaceSnapshot ||
      context.weeklyPlanningSnapshot,
  );

  return (
    <div className="flex min-h-[42rem] min-w-0 flex-col gap-0">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border/60 px-6 py-4 xl:flex-row xl:items-start xl:justify-between shrink-0">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h1 className="font-serif text-xl font-semibold">Copilot</h1>
          </div>
          {hasContext && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Context:</span>
              {context.learnerName && (
                <Badge variant="secondary" className="text-xs">
                  {context.learnerName}
                </Badge>
              )}
              {context.curriculumSourceId && (
                <Badge variant="outline" className="text-xs">
                  Curriculum
                </Badge>
              )}
              {context.lessonId && (
                <Badge variant="outline" className="text-xs">
                  Lesson
                </Badge>
              )}
              {context.weeklyPlanningSnapshot && (
                <Badge variant="outline" className="text-xs">
                  Week {context.weeklyPlanningSnapshot.weekLabel}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Badge variant="outline" className="text-xs">
            {routing.providerId}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {activeChatModel}
          </Badge>
        </div>
      </div>

      {/* Chat */}
      <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_280px]">
        <CopilotChat context={context} className="h-full min-w-0 overflow-hidden" />

        {/* Sidebar */}
        <div className="hidden min-w-0 flex-col gap-4 border-l border-border/60 p-4 overflow-y-auto xl:flex">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">What I can help with</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
              <p>• Draft lesson plans and outlines</p>
              <p>• Generate worksheets and activities</p>
              <p>• Suggest relevant standards</p>
              <p>• Summarize curriculum materials</p>
              <p>• Review progress and suggest plan adaptations</p>
              <p>• Answer questions about teaching and learning</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Generation tasks</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
              <p className="text-foreground/80 font-medium">Long-running tasks (async):</p>
              <p>• Lesson drafts</p>
              <p>• Worksheet generation</p>
              <p>• Interactive activities</p>
              <p>• Plan adaptation</p>
              <p className="mt-2 text-foreground/80 font-medium">Inline tasks:</p>
              <p>• Standards suggestions</p>
              <p>• Text summarization</p>
              <p>• Chat answers</p>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground/60 px-1">
            Copilot provider and model routing come from{" "}
            <code className="font-mono text-[10px]">lib/ai/routing.ts</code>.
          </p>
        </div>
      </div>
  </div>
);
}
