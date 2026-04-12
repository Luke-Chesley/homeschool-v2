"use client";

/**
 * CopilotChat — streaming chat UI for the parent workspace copilot.
 *
 * Streams responses from /api/ai/chat via Server-Sent Events.
 * Actions returned by the AI are rendered as CopilotActionCards.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { CopilotActionCard } from "./CopilotActionCard";
import type { ChatMessage as ChatMessageType, CopilotAction, CopilotContext } from "@/lib/ai/types";

interface Props {
  sessionId?: string;
  initialMessages?: ChatMessageType[];
  context?: CopilotContext;
  className?: string;
}

export function CopilotChat({ sessionId: initialSessionId, initialMessages = [], context, className }: Props) {
  const [sessionId, setSessionId] = React.useState(initialSessionId);
  const [messages, setMessages] = React.useState<ChatMessageType[]>(initialMessages);
  const [streamingContent, setStreamingContent] = React.useState<string | null>(null);
  const [actions, setActions] = React.useState<CopilotAction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function sendMessage(content: string) {
    const userMessage: ChatMessageType = {
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);
    setStreamingContent("");
    setError(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          context,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Chat request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          if (!json.trim()) continue;

          let event: any;
          try {
            event = JSON.parse(json);
          } catch {
            // Skip malformed events
            continue;
          }

          if (event.sessionId && !sessionId) {
            setSessionId(event.sessionId);
          }

          if (event.delta) {
            accumulated += event.delta;
            setStreamingContent(accumulated);
          }

          if (event.error) {
            throw new Error(event.error);
          }

          if (event.done) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant" as const,
                content: accumulated,
                createdAt: new Date().toISOString(),
              },
            ]);
            setStreamingContent(null);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setStreamingContent(null);
    } finally {
      setLoading(false);
    }
  }

  function handleApplyAction(action: CopilotAction) {
    setActions((prev) =>
      prev.map((a) => (a.id === action.id ? { ...a, status: "applied" as const } : a))
    );
    // Integration point: dispatch action to relevant domain (planning, curriculum, etc.)
    console.info("[copilot] Action applied:", action.kind, action.label);
  }

  function handleDismissAction(action: CopilotAction) {
    setActions((prev) =>
      prev.map((a) => (a.id === action.id ? { ...a, status: "dismissed" as const } : a))
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col h-full", className)}>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-start justify-center gap-5">
            <div className="max-w-2xl space-y-2">
              <p className="font-serif text-3xl text-foreground">Ask for the next move.</p>
              <p className="text-sm leading-7 text-muted-foreground">
                Keep requests grounded in the learner, today&apos;s plan, or the current week. Copilot works
                best when the question is specific enough to turn into a real next action.
              </p>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {[
                "Draft a lesson on fractions for grade 4",
                "What standards cover place value?",
                "Suggest activities for a reluctant reader",
                "Review our progress this week",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} />
        ))}

        {streamingContent !== null && (
          <div className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary/25 text-xs font-medium text-secondary-foreground">
              AI
            </div>
            <div className="max-w-[85%] rounded-lg border border-border/60 bg-card px-4 py-3 text-sm leading-7 break-words whitespace-pre-wrap">
              {streamingContent}
              <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {actions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="px-2 text-xs font-medium text-muted-foreground">Suggested actions</p>
            {actions.map((action) => (
              <CopilotActionCard
                key={action.id}
                action={action}
                onApply={handleApplyAction}
                onDismiss={handleDismissAction}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border/60 p-4 sm:px-6">
        <ChatInput onSend={sendMessage} disabled={loading} />
      </div>
    </div>
  );
}
