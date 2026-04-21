import { ArrowRight, Bot, CalendarRange, NotebookPen, Sparkles, Waypoints } from "lucide-react";

import { CopilotChat } from "@/components/copilot/CopilotChat";
import { CopilotPromptPreview } from "@/components/copilot/CopilotPromptPreview";
import { MetricCard } from "@/components/ui/metric-card";
import { PromptChip } from "@/components/ui/prompt-chip";
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
    <main className="page-shell page-stack">
      <header className="dashboard-grid items-start border-b border-border/70 pb-5">
        <div className="space-y-3 max-w-4xl">
          <p className="section-meta">Copilot</p>
          <h1 className="page-title">Ask for the next helpful move</h1>
          <p className="page-subtitle max-w-3xl">
            Keep the conversation grounded in today, the current week, and the learner you are actively teaching.
          </p>
          <div className="metric-grid pt-2">
            <MetricCard
              label="Learner"
              value={context.learnerName ?? session.activeLearner.displayName}
              hint="The active learner stays attached to this conversation."
              icon={Bot}
            />
            <MetricCard
              label="Day context"
              value={context.dailyWorkspaceSnapshot ? "Attached" : "Not attached"}
              hint="Today data gives Copilot lesson and queue awareness."
              icon={NotebookPen}
              tone="secondary"
            />
            <MetricCard
              label="Week context"
              value={context.weeklyPlanningSnapshot ? "Attached" : "Not attached"}
              hint="Week planning helps Copilot make concrete schedule suggestions."
              icon={CalendarRange}
            />
          </div>
        </div>

        <aside className="context-rail">
          <div className="space-y-2">
            <p className="section-meta">Attached now</p>
            <div className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>Source: <span className="font-medium text-foreground">{liveSource?.title ?? "None selected"}</span></p>
              <p>Day snapshot: <span className="font-medium text-foreground">{context.dailyWorkspaceSnapshot ? "Included" : "Missing"}</span></p>
              <p>Week snapshot: <span className="font-medium text-foreground">{context.weeklyPlanningSnapshot ? "Included" : "Missing"}</span></p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="section-meta">Good starting asks</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt) => (
                <PromptChip key={prompt} className="pointer-events-none opacity-100">
                  {prompt}
                </PromptChip>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">Best results</p>
            <p className="mt-2">
              Ask for one concrete decision at a time, then apply or dismiss suggestions directly from the conversation.
            </p>
          </div>
        </aside>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card variant="glass" className="min-h-[42rem] overflow-hidden">
          <CopilotChat context={context} className="h-full min-w-0 overflow-hidden" />
        </Card>

        <div className="space-y-4">
          <Card variant="glass">
            <div className="space-y-3 p-4 text-sm leading-6">
              <div className="flex items-center gap-2">
                <Waypoints className="size-4 text-muted-foreground" />
                <p className="font-medium text-foreground">Current context</p>
              </div>
              <div className="space-y-2 text-muted-foreground">
                <p>Learner: {context.learnerName}</p>
                <p>Source: {liveSource?.title ?? "None"}</p>
                <p>Day: {context.dailyWorkspaceSnapshot ? "Attached" : "None"}</p>
                <p>Week: {context.weeklyPlanningSnapshot ? "Attached" : "None"}</p>
              </div>
            </div>
          </Card>

          <Card variant="glass">
            <div className="space-y-3 p-4 text-sm leading-6">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" />
                <p className="font-medium text-foreground">Start with</p>
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
