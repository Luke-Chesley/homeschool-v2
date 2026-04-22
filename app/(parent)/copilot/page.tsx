import { ArrowRight, Waypoints } from "lucide-react";

import { CopilotChat } from "@/components/copilot/CopilotChat";
import { CopilotPromptPreview } from "@/components/copilot/CopilotPromptPreview";
import { Card } from "@/components/ui/card";
import type { CopilotContext } from "@/lib/ai/types";
import { requireAppSession } from "@/lib/app-session/server";
import { getLiveCurriculumSource } from "@/lib/curriculum/service";
import { toWeekStartDate } from "@/lib/curriculum-routing";
import { previewCopilotChat } from "@/lib/learning-core/copilot";
import { buildCopilotPlanningContext } from "@/lib/planning/copilot-snapshot";
import { getOrCreateWeeklyRouteBoardForLearner } from "@/lib/planning/weekly-route-service";

export const metadata = {
  title: "Copilot",
};

interface Props {
  searchParams: Promise<{
    learnerId?: string;
    learnerName?: string;
    lessonId?: string;
    date?: string;
  }>;
}

export default async function CopilotPage({ searchParams }: Props) {
  const session = await requireAppSession();
  const params = await searchParams;
  const liveSource = await getLiveCurriculumSource(session.organization.id);
  const liveSourceId = liveSource?.id;
  const selectedWeekStartDate = toWeekStartDate(params.date);
  const planningContext = liveSourceId
    ? await getOrCreateWeeklyRouteBoardForLearner({
        learnerId: session.activeLearner.id,
        sourceId: liveSourceId,
        weekStartDate: selectedWeekStartDate,
      })
    : null;
  const snapshot =
    planningContext && liveSourceId
      ? buildCopilotPlanningContext({
          board: planningContext.board,
          learnerId: session.activeLearner.id,
          learnerName: session.activeLearner.displayName,
          sourceId: liveSourceId,
          selectedDate: params.date,
        })
      : null;

  const context: CopilotContext = {
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    curriculumSourceId: liveSource?.id,
    lessonId: params.lessonId,
    standardIds: [],
    goalIds: [],
    curriculumSnapshot: snapshot?.curriculumSnapshot,
    dailyWorkspaceSnapshot: snapshot?.dailyWorkspaceSnapshot,
    weeklyPlanningSnapshot: snapshot?.weeklyPlanningSnapshot,
    feedbackNotes: snapshot?.feedbackNotes ?? [],
    recentOutcomes: [],
  };
  let promptPreview:
    | Awaited<ReturnType<typeof previewCopilotChat>>
    | null = null;
  let previewError: string | null = null;

  try {
    promptPreview = await previewCopilotChat({
      messages: [],
      context,
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
    });
  } catch (error) {
    previewError =
      error instanceof Error ? error.message : "Copilot preview is unavailable right now.";
  }

  const suggestedPrompts = [
    "Draft today's lesson from the current route.",
    "Reduce tomorrow to the essentials.",
    "Capture a short note about what changed this week.",
    "Tell me what to adjust next in planning.",
  ] as const;

  return (
    <main className="page-shell">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <Card variant="glass" className="min-h-[42rem] overflow-hidden">
          <CopilotChat context={context} className="h-full min-w-0 overflow-hidden" />
        </Card>

        <div className="space-y-4">
          <Card variant="glass">
            <div className="space-y-3 p-4 text-sm leading-6">
              <div className="flex items-center gap-2">
                <Waypoints className="size-4 text-muted-foreground" />
                <p className="font-medium text-foreground">Start with</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/72 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Attached now
                </p>
                <div className="mt-3 space-y-2 text-muted-foreground">
                  <p>
                    Source:{" "}
                    <span className="font-medium text-foreground">
                      {liveSource?.title ?? "None selected"}
                    </span>
                  </p>
                  <p>
                    Today:{" "}
                    <span className="font-medium text-foreground">
                      {context.dailyWorkspaceSnapshot ? "Attached" : "Not attached"}
                    </span>
                  </p>
                  <p>
                    Week:{" "}
                    <span className="font-medium text-foreground">
                      {context.weeklyPlanningSnapshot ? "Attached" : "Not attached"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-muted-foreground">
                {suggestedPrompts.map((prompt) => (
                  <div
                    key={prompt}
                    className="flex items-start gap-2 rounded-2xl border border-border/70 bg-background/72 px-3 py-2.5"
                  >
                    <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                    <p>{prompt}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {previewError ? (
            <Card variant="glass">
              <div className="space-y-2 p-4 text-sm leading-6">
                <p className="font-medium text-foreground">Copilot is temporarily unavailable</p>
                <p className="text-muted-foreground">
                  Try again in a moment. Your learner and planning context are still intact.
                </p>
              </div>
            </Card>
          ) : null}

          <CopilotPromptPreview promptPreview={promptPreview} />
        </div>
      </div>
    </main>
  );
}
