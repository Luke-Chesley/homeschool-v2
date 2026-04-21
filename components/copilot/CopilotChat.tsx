"use client";

/**
 * CopilotChat - streaming chat UI for the parent workspace copilot.
 *
 * Streams responses from /api/ai/chat via Server-Sent Events.
 * Actions returned by the AI are rendered as CopilotActionCards.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { CopilotActionCard } from "./CopilotActionCard";
import {
  CopilotActionSchema,
  CopilotStreamEventSchema,
  type ChatMessage as ChatMessageType,
  type CopilotAction,
  type CopilotContext,
} from "@/lib/ai/types";

interface Props {
  sessionId?: string;
  initialMessages?: ChatMessageType[];
  context?: CopilotContext;
  className?: string;
}

function mergeActionsById(current: CopilotAction[], next: CopilotAction[]) {
  const merged = new Map(current.map((action) => [action.id, action]));

  for (const action of next) {
    merged.set(action.id, action);
  }

  return [...merged.values()];
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

  async function mutateAction(
    action: CopilotAction,
    endpoint: "/api/copilot/actions/apply" | "/api/copilot/actions/dismiss",
    optimisticStatus: CopilotAction["status"],
  ) {
    if (!sessionId) {
      throw new Error("Start a Copilot conversation before applying actions.");
    }

    const previousStatus = action.status;
    setActions((prev) =>
      prev.map((current) =>
        current.id === action.id
          ? {
              ...current,
              status: optimisticStatus,
              error: null,
            }
          : current,
      ),
    );

    let payload: unknown = null;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          actionId: action.id,
        }),
      });

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const parsedAction =
        payload &&
        typeof payload === "object" &&
        "action" in payload &&
        payload.action !== undefined
          ? CopilotActionSchema.safeParse(payload.action)
          : null;

      if (parsedAction?.success) {
        setActions((prev) => mergeActionsById(prev, [parsedAction.data]));
      }

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Copilot action failed.";

        if (!parsedAction?.success) {
          setActions((prev) =>
            prev.map((current) =>
              current.id === action.id
                ? {
                    ...current,
                    status: endpoint === "/api/copilot/actions/dismiss" ? previousStatus : "failed",
                    error: message,
                  }
                : current,
            ),
          );
        }

        throw new Error(message);
      }
    } catch (error) {
      if (endpoint === "/api/copilot/actions/dismiss") {
        setActions((prev) =>
          prev.map((current) =>
            current.id === action.id
              ? {
                  ...current,
                  status: previousStatus,
                  error: error instanceof Error ? error.message : "Could not dismiss the action.",
                }
              : current,
          ),
        );
      }

      throw error;
    }
  }

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
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const rawEvent = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          const dataLine = rawEvent
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) {
            continue;
          }

          let parsedJson: unknown;
          try {
            parsedJson = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }

          const event = CopilotStreamEventSchema.safeParse(parsedJson);
          if (!event.success) {
            continue;
          }

          const streamEvent = event.data;

          switch (streamEvent.type) {
            case "session":
              setSessionId(streamEvent.sessionId);
              continue;
            case "delta":
              accumulated += streamEvent.delta;
              setStreamingContent(accumulated);
              continue;
            case "actions":
              setActions((prev) => mergeActionsById(prev, streamEvent.actions));
              continue;
            case "error":
              throw new Error(streamEvent.error);
            case "done":
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant" as const,
                  content: accumulated,
                  createdAt: new Date().toISOString(),
                },
              ]);
              setStreamingContent(null);
              break;
          }
        }

        if (done) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setStreamingContent(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyAction(action: CopilotAction) {
    try {
      await mutateAction(action, "/api/copilot/actions/apply", "applying");
    } catch {
      // Action-specific error state is already reflected in the action card.
    }
  }

  async function handleDismissAction(action: CopilotAction) {
    try {
      await mutateAction(action, "/api/copilot/actions/dismiss", "dismissed");
    } catch {
      // Action-specific error state is already reflected in the action card.
    }
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
                "Lighten Thursday by moving one item to Friday.",
                "Generate today's lesson draft from the current route.",
                "Write a short note about what stalled this week.",
                "Which route item should we defer if tomorrow needs to be lighter?",
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
