"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { LearningCorePromptPreviewCard } from "@/components/debug/LearningCorePromptPreviewCard";
import { Button } from "@/components/ui/button";

type PromptPreviewState =
  | { status: "idle"; open: false }
  | { status: "loading"; open: true }
  | {
      status: "ready";
      open: true;
      preview: {
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
  | { status: "error"; open: true; message: string };

interface ProgressionPromptPreviewProps {
  sourceId: string;
}

export function ProgressionPromptPreview({ sourceId }: ProgressionPromptPreviewProps) {
  const [state, setState] = React.useState<PromptPreviewState>({ status: "idle", open: false });

  React.useEffect(() => {
    setState({ status: "idle", open: false });
  }, [sourceId]);

  async function handleToggle() {
    if (state.open && state.status !== "loading") {
      setState({ status: "idle", open: false });
      return;
    }

    setState({ status: "loading", open: true });

    try {
      const response = await fetch(`/api/curriculum/sources/${sourceId}/progression-prompt`);
      const data = (await response.json()) as
        | {
            debug: {
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
        | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Prompt preview failed.");
      }

      if (!("debug" in data)) {
        throw new Error("Prompt preview failed.");
      }

      setState({
        status: "ready",
        open: true,
        preview: data.debug,
      });
    } catch (error) {
      setState({
        status: "error",
        open: true,
        message: error instanceof Error ? error.message : "Prompt preview failed.",
      });
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggle}
        className="justify-between"
        aria-expanded={state.open}
        aria-controls={`progression-prompt-preview-${sourceId}`}
      >
        <span className="flex items-center gap-2">
          {state.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
          <span>{state.open ? "Hide prompt" : "View prompt"}</span>
        </span>
        <span className="ml-2 text-xs text-muted-foreground">debug</span>
      </Button>

      {state.open ? (
        <div
          id={`progression-prompt-preview-${sourceId}`}
          className="mt-3 rounded-lg border border-border/70 bg-background p-4 shadow-[var(--shadow-card)]"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Progression prompt preview</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Exact system + user prompts sent for progression graph generation.
            </p>
          </div>

          {state.status === "error" ? (
            <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          ) : null}

          {state.status === "loading" ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Building prompt preview…
            </div>
          ) : null}

          {state.status === "ready" ? (
            <div className="mt-4 grid gap-4">
              <LearningCorePromptPreviewCard preview={state.preview} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
