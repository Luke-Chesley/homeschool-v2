"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { LearningCorePromptPreviewCard } from "@/components/debug/LearningCorePromptPreviewCard";

interface CopilotPromptPreviewProps {
  promptPreview: {
    operation_name: string;
    skill_name: string;
    skill_version: string;
    request_id: string;
    allowed_tools: string[];
    system_prompt: string;
    user_prompt: string;
    request_envelope: unknown;
  };
}

export function CopilotPromptPreview({ promptPreview }: CopilotPromptPreviewProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((current) => !current)}
        className="w-full justify-between"
        aria-expanded={open}
        aria-controls="copilot-prompt-preview"
      >
        <span>{open ? "Hide prompt" : "View prompt"}</span>
        <span className="text-xs text-muted-foreground">debug</span>
      </Button>

      {open ? (
        <div
          id="copilot-prompt-preview"
          className="mt-3 w-full rounded-lg border border-border/70 bg-background p-4 shadow-[var(--shadow-card)] sm:absolute sm:right-0 sm:top-11 sm:mt-0 sm:max-w-3xl"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Prompt preview</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Exact request envelope and effective prompts returned by learning-core.
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-border/70 bg-muted/25 p-4">
            <LearningCorePromptPreviewCard preview={promptPreview} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
