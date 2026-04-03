import * as React from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/ai/types";

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  if (message.role === "system") return null;

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 flex size-8 items-center justify-center rounded-md text-xs font-medium",
          isUser
            ? "bg-primary/15 text-primary"
            : "bg-secondary/25 text-secondary-foreground"
        )}
      >
        {isUser ? "You" : "AI"}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed break-words",
          isUser
            ? "bg-primary/10 text-foreground"
            : "border border-border/60 bg-card text-foreground",
          isAssistant && "whitespace-pre-wrap"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
