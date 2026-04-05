"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CurriculumAiChatMessage } from "@/lib/curriculum/ai-draft";

type PromptPreviewState =
  | { status: "idle"; open: false }
  | { status: "loading"; open: true }
  | { status: "ready"; open: true; systemPrompt: string; userPrompt: string }
  | { status: "error"; open: true; message: string };

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
  const [state, setState] = React.useState<PromptPreviewState>({
    status: "idle",
    open: false,
  });
  const messagesKey = React.useMemo(() => JSON.stringify(messages), [messages]);

  React.useEffect(() => {
    setState({ status: "idle", open: false });
  }, [sourceId, messagesKey]);

  async function handleToggle() {
    if (state.open && state.status !== "loading") {
      setState({ status: "idle", open: false });
      return;
    }

    setState({ status: "loading", open: true });

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
        | { debug: { systemPrompt: string; userPrompt: string }; error?: string }
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
        systemPrompt: data.debug.systemPrompt,
        userPrompt: data.debug.userPrompt,
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
        className="w-full justify-between"
        aria-expanded={state.open}
        aria-controls={`curriculum-prompt-preview-${sourceId}`}
      >
        <span className="flex items-center gap-2">
          {state.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
          <span>{state.open ? "Hide prompt" : "View prompt"}</span>
        </span>
        <span className="text-xs text-muted-foreground">debug</span>
      </Button>

      {state.open ? (
        <div
          id={`curriculum-prompt-preview-${sourceId}`}
          className="mt-3 rounded-lg border border-border/70 bg-background p-4 shadow-[var(--shadow-card)]"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Prompt preview</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Exact revision prompt for {sourceTitle}.
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
              <div>
                <p className="text-sm font-medium text-foreground">System</p>
                <pre className="mt-2 max-h-[12rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
                  {state.systemPrompt}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">User</p>
                <pre className="mt-2 max-h-[20rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
                  {state.userPrompt}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
