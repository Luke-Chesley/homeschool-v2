"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { LearningCorePromptPreviewCard } from "@/components/debug/LearningCorePromptPreviewCard";
import { StudioDrawer } from "@/components/studio/StudioDrawer";
import { useStudio } from "@/components/studio/studio-provider";
import { Button } from "@/components/ui/button";

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

interface ProgressionPromptPreviewProps {
  sourceId: string;
}

export function ProgressionPromptPreview({ sourceId }: ProgressionPromptPreviewProps) {
  const [state, setState] = React.useState<PromptPreviewState>({ status: "idle" });
  const { access, isEnabled, openPanel } = useStudio();
  const panelId = `progression-prompt-preview-${sourceId}`;

  React.useEffect(() => {
    setState({ status: "idle" });
  }, [sourceId]);

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
      const response = await fetch(`/api/curriculum/sources/${sourceId}/progression-prompt`);
      const data = (await response.json()) as
        | { debug: PromptPreviewData }
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
      <Button type="button" variant="outline" size="sm" onClick={handleOpen} className="justify-between">
        <span className="flex items-center gap-2">
          {state.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
          <span>Prompt preview</span>
        </span>
        <span className="ml-2 text-xs text-muted-foreground">studio</span>
      </Button>

      <StudioDrawer
        panelId={panelId}
        title="Progression prompt preview"
        description="Exact system and user prompts sent for progression generation."
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
