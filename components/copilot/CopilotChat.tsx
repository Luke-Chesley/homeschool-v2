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

          try {
            const event = JSON.parse(json);

            if (event.sessionId && !sessionId) {
              setSessionId(event.sessionId);
            }

            if (event.delta) {
              accumulated += event.delta;
              setStreamingContent(accumulated);
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

            if (event.error) {
              throw new Error(event.error);
            }
          } catch (parseErr) {
            // Skip malformed events
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
    <div className={cn("flex flex-col h-full", className)}>
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-lg font-serif font-semibold text-foreground/70">
              How can I help?
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Ask about curriculum planning, lesson ideas, standards mapping, or anything else.
            </p>
            {/* Suggested prompts */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
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
                  className="rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 transition-colors"
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

        {/* Streaming message */}
        {streamingContent !== null && (
          <div className="flex gap-3">
            <div className="shrink-0 flex size-8 items-center justify-center rounded-full bg-secondary/25 text-secondary-foreground text-xs font-semibold">
              AI
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border/60 bg-card/80 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              {streamingContent}
              <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {/* Pending actions */}
        {actions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2">
              Suggested actions
            </p>
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
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/60 p-4">
        <ChatInput onSend={sendMessage} disabled={loading} />
      </div>
    </div>
  );
}
