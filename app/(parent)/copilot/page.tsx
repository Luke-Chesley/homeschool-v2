import { CopilotChat } from "@/components/copilot/CopilotChat";
import { CopilotPromptPreview } from "@/components/copilot/CopilotPromptPreview";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAiRoutingConfig } from "@/lib/ai/routing";
import type { CopilotContext } from "@/lib/ai/types";
import { requireAppSession } from "@/lib/app-session/server";
import { listCurriculumSources } from "@/lib/curriculum/service";
import { toWeekStartDate } from "@/lib/curriculum-routing";
import { resolvePrompt } from "@/lib/prompts/store";
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

  const context: CopilotContext = {
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
  const promptRecord = await resolvePrompt("chat.answer");
  const promptPreview = buildPromptPreview(promptRecord.systemPrompt, context);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-border/70 pb-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight">Copilot</h1>
            <p className="mt-1 text-sm text-muted-foreground">{session.activeLearner.displayName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{routing.providerId}</Badge>
            <Badge variant="outline">{activeChatModel}</Badge>
            {context.curriculumSourceId ? <Badge variant="outline">Curriculum loaded</Badge> : null}
            {context.weeklyPlanningSnapshot ? <Badge variant="outline">Week loaded</Badge> : null}
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-h-[42rem] overflow-hidden">
          <CopilotChat context={context} className="h-full min-w-0 overflow-hidden" />
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="space-y-3 p-4 text-sm">
              <p className="font-medium text-foreground">Current context</p>
              <div className="space-y-2 text-muted-foreground">
                <p>Learner: {context.learnerName}</p>
                <p>Source: {context.curriculumSourceId ? "Attached" : "None"}</p>
                <p>Day: {context.dailyWorkspaceSnapshot ? "Attached" : "None"}</p>
                <p>Week: {context.weeklyPlanningSnapshot ? "Attached" : "None"}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-3 p-4 text-sm">
              <p className="font-medium text-foreground">Start with</p>
              <div className="space-y-2 text-muted-foreground">
                <p>Draft today&apos;s lesson.</p>
                <p>Trim tomorrow&apos;s workload.</p>
                <p>Map a skill to standards.</p>
                <p>Adjust the week after missed work.</p>
              </div>
            </div>
          </Card>

          <CopilotPromptPreview promptPreview={promptPreview} />

          <p className="px-1 text-xs text-muted-foreground/60">
            Copilot provider and model routing come from{" "}
            <code className="font-mono text-[10px]">lib/ai/routing.ts</code>.
          </p>
        </div>
      </div>
    </main>
  );
}

function buildPromptPreview(systemPrompt: string, context: CopilotContext) {
  const contextString = JSON.stringify(context, null, 2);
  return `${systemPrompt}\n\nContext:\n${contextString}`;
}
