"use client";

import * as React from "react";

import { LearningCorePromptPreviewCard } from "@/components/debug/LearningCorePromptPreviewCard";
import { StudioDrawer } from "@/components/studio/StudioDrawer";
import { useStudio } from "@/components/studio/studio-provider";
import { Button } from "@/components/ui/button";

const COPILOT_PROMPT_PANEL_ID = "copilot-prompt-preview";

interface CopilotPromptPreviewProps {
  promptPreview:
    | {
        operation_name: string;
        skill_name: string;
        skill_version: string;
        request_id: string;
        allowed_tools: string[];
        system_prompt: string;
        user_prompt: string;
        request_envelope: unknown;
      }
    | null;
}

export function CopilotPromptPreview({ promptPreview }: CopilotPromptPreviewProps) {
  const { access, isEnabled, openPanel } = useStudio();

  if (!promptPreview || !isEnabled || !access.canViewPrompts) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => openPanel(COPILOT_PROMPT_PANEL_ID)}
        className="w-full justify-between"
      >
        <span>Prompt preview</span>
        <span className="text-xs text-muted-foreground">studio</span>
      </Button>

      <StudioDrawer
        panelId={COPILOT_PROMPT_PANEL_ID}
        title="Assistant prompt preview"
        description="Exact request envelope and effective prompts returned by learning-core for the current assistant context."
      >
        <LearningCorePromptPreviewCard preview={promptPreview} />
      </StudioDrawer>
    </>
  );
}
