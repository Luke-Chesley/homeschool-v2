"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { LearningCorePromptPreviewCard } from "@/components/debug/LearningCorePromptPreviewCard";
import { StudioDrawer } from "@/components/studio/StudioDrawer";
import { useStudio } from "@/components/studio/studio-provider";
import { Button } from "@/components/ui/button";
import type { CurriculumAiChatMessage } from "@/lib/curriculum/ai-draft";

type PromptPreviewData = {
  operation_name: string;
  skill_name: string;
  skill_version: string;
  request_id: string;
  allowed_tools: string[];
  system_prompt: string;
  user_prompt: string;
  request_envelope: unknown;
};

type PromptPreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: PromptPreviewData }
  | { status: "error"; message: string };

interface CurriculumRevisionPromptPreviewProps {
  sourceId: string;
  sourceTitle: string;
  messages: CurriculumAiChatMessage[];
}

export function CurriculumRevisionPromptPreview({
  sourceId,
  sourceTitle,
  messages,
}: CurriculumRevisionPromptPreviewProps) {
  const [state, setState] = React.useState<PromptPreviewState>({ status: "idle" });
  const { access, isEnabled, openPanel } = useStudio();
  const messagesKey = React.useMemo(() => JSON.stringify(messages), [messages]);
  const panelId = `curriculum-prompt-preview-${sourceId}`;

  React.useEffect(() => {
    setState({ status: "idle" });
  }, [sourceId, messagesKey]);

  if (!isEnabled || !access.canViewPrompts) {
    return null;
  }

  async function handleOpen() {
    openPanel(panelId);

    if (state.status === "ready" || state.status === "loading") {
      return;
    }

    setState({ status: "loading" });

    try {
      const response = await fetch(`/api/curriculum/sources/${sourceId}/ai-revise`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          debug: true,
        }),
      });

      const data = (await response.json()) as
        | { debug: PromptPreviewData; error?: string }
        | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Prompt preview failed.");
      }

      if (!("debug" in data)) {
        throw new Error("Prompt preview failed.");
      }

      setState({
        status: "ready",
        preview: data.debug,
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Prompt preview failed.",
      });
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handleOpen} className="w-full justify-between">
        <span className="flex items-center gap-2">
          {state.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
          <span>Prompt preview</span>
        </span>
        <span className="text-xs text-muted-foreground">studio</span>
      </Button>

      <StudioDrawer
        panelId={panelId}
        title="Curriculum revision prompt preview"
        description={`Exact revision prompt for ${sourceTitle}.`}
      >
        {state.status === "error" ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </div>
        ) : null}

        {state.status === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Building prompt preview...
          </div>
        ) : null}

        {state.status === "ready" ? <LearningCorePromptPreviewCard preview={state.preview} /> : null}
      </StudioDrawer>
    </>
  );
}
