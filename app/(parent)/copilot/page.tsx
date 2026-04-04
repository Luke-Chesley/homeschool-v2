import { CopilotChat } from "@/components/copilot/CopilotChat";
import { CopilotPromptPreview } from "@/components/copilot/CopilotPromptPreview";
import { Card } from "@/components/ui/card";
import type { CopilotContext } from "@/lib/ai/types";
import { requireAppSession } from "@/lib/app-session/server";
import { getLiveCurriculumSource } from "@/lib/curriculum/service";
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
  const promptRecord = await resolvePrompt("chat.answer");
  const promptPreview = buildPromptPreview(promptRecord.systemPrompt, context);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
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
                <p>Source: {liveSource?.title ?? "None"}</p>
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
