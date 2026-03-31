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
import { getAiRoutingConfig } from "@/lib/ai/routing";

export const metadata = {
  title: "Copilot",
};

interface Props {
  searchParams: Promise<{
    learnerId?: string;
    learnerName?: string;
    lessonId?: string;
    sourceId?: string;
  }>;
}

export default async function CopilotPage({ searchParams }: Props) {
  const params = await searchParams;
  const routing = getAiRoutingConfig();
  const activeChatModel = routing.taskDefaults["chat.answer"] ?? routing.fallbackModel;

  const context = {
    learnerId: params.learnerId,
    learnerName: params.learnerName,
    curriculumSourceId: params.sourceId,
    lessonId: params.lessonId,
    standardIds: [],
    goalIds: [],
    recentOutcomes: [],
  };

  const hasContext = !!(
    context.learnerId || context.curriculumSourceId || context.lessonId
  );

  return (
    <div className="flex min-h-[42rem] flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h1 className="font-serif text-xl font-semibold">Copilot</h1>
        </div>
        {hasContext && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {routing.providerId}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {activeChatModel}
          </Badge>
        </div>
      </div>

      {/* Chat */}
      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1fr_280px]">
        <CopilotChat context={context} className="h-full overflow-hidden" />

        {/* Sidebar */}
        <div className="hidden lg:flex flex-col gap-4 border-l border-border/60 p-4 overflow-y-auto">
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
            <code className="font-mono text-[10px]">lib/ai/registry.ts</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
