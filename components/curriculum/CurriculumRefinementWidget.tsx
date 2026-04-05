"use client";

import * as React from "react";
import { Loader2, RefreshCcw, Sparkles, Wand2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { ChatInput } from "@/components/copilot/ChatInput";
import { CurriculumRevisionPromptPreview } from "@/components/curriculum/CurriculumRevisionPromptPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  CurriculumAiChatMessage,
  CurriculumAiRevisionResponse,
} from "@/lib/curriculum/ai-draft";
import { cn } from "@/lib/utils";

interface CurriculumRefinementWidgetProps {
  sourceId: string;
  sourceTitle: string;
  className?: string;
}

function buildWelcomeMessage(sourceTitle: string): CurriculumAiChatMessage {
  return {
    role: "assistant",
    content: `What would you like to change about ${sourceTitle}? You can ask for a targeted adjustment or a broader rewrite.`,
  };
}

export function CurriculumRefinementWidget({
  sourceId,
  sourceTitle,
  className,
}: CurriculumRefinementWidgetProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<CurriculumAiChatMessage[]>([
    buildWelcomeMessage(sourceTitle),
  ]);
  const [response, setResponse] = React.useState<CurriculumAiRevisionResponse | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMessages([buildWelcomeMessage(sourceTitle)]);
    setResponse(null);
    setError(null);
    setSubmitting(false);
  }, [sourceId]);

  async function handleSend(content: string) {
    const userMessage: CurriculumAiChatMessage = {
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/curriculum/sources/${sourceId}/ai-revise`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to revise the curriculum.");
      }

      const payload = (await res.json()) as CurriculumAiRevisionResponse;
      const assistantMessage: CurriculumAiChatMessage = {
        role: "assistant",
        content: payload.assistantMessage,
      };

      setMessages([...nextMessages, assistantMessage]);
      setResponse(payload);

      if (payload.action === "applied") {
        router.refresh();
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to revise the curriculum.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setMessages([buildWelcomeMessage(sourceTitle)]);
    setResponse(null);
    setError(null);
    setSubmitting(false);
  }

  return (
    <div className={cn("fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3", className)}>
      {open ? (
        <Card className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden border-border/80 bg-background/95 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.45)] backdrop-blur">
          <CardContent className="flex flex-col gap-4 p-0">
            <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="gap-1 rounded-full">
                    <Sparkles className="size-3" />
                    Curriculum refine
                  </Badge>
                  {response?.action === "applied" ? (
                    <Badge variant="outline" className="rounded-full">
                      Updated
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-foreground">{sourceTitle}</p>
                <p className="text-xs text-muted-foreground">
                  Ask for a new goal group, pacing change, title update, or broader rewrite.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={handleReset}
                  aria-label="Restart refinement conversation"
                >
                  <RefreshCcw className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setOpen(false)}
                  aria-label="Close refinement panel"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="border-b border-border/70 px-4 py-4">
              <CurriculumRevisionPromptPreview
                sourceId={sourceId}
                sourceTitle={sourceTitle}
                messages={messages}
              />
            </div>

            <div className="max-h-[24rem] space-y-3 overflow-y-auto px-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl border px-3 py-2 text-sm leading-relaxed",
                      message.role === "user"
                        ? "border-primary/20 bg-primary/10 text-foreground"
                        : "border-border/70 bg-card text-foreground",
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {submitting ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Revising curriculum…
                  </div>
                </div>
              ) : null}
            </div>

            {response?.changeSummary.length ? (
              <div className="space-y-2 border-t border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Latest change
                </p>
                <div className="space-y-1">
                  {response.changeSummary.map((item) => (
                    <p key={item} className="text-sm text-foreground">
                      {item}
                    </p>
                  ))}
                </div>
                {response.action === "applied" ? (
                  <p className="text-xs text-muted-foreground">
                    {response.skillCount ?? 0} skills, {response.unitCount ?? 0} units,{" "}
                    {response.estimatedSessionCount ?? 0} estimated sessions.
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="px-4">
                <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              </div>
            ) : null}

            <div className="border-t border-border/70 p-4">
              <ChatInput
                onSend={handleSend}
                disabled={submitting}
                placeholder="Add a goal group, adjust pacing, rename it, or rewrite the structure…"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Button
        type="button"
        size="sm"
        className="gap-2 rounded-full pl-3 pr-4 shadow-[0_14px_40px_-24px_rgba(15,23,42,0.55)]"
        onClick={() => setOpen((value) => !value)}
      >
        <Wand2 className="size-4" />
        Customize curriculum
      </Button>
    </div>
  );
}
