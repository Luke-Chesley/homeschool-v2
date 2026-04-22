import * as React from "react";
import { Bot, UserRound } from "lucide-react";

import { MarkdownContent } from "@/components/ui/markdown-content";
import { getRenderableCopilotContent } from "@/lib/ai/copilot-message-content";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/ai/types";

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const renderableContent = isAssistant
    ? getRenderableCopilotContent(message.content)
    : message.content;
  const createdAtLabel = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Now";

  if (message.role === "system") return null;

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser && "flex-row-reverse"
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-2xl border shadow-[var(--shadow-soft)]",
          isUser
            ? "border-primary/20 bg-primary/12 text-primary"
            : "border-border/70 bg-[var(--glass-panel)] text-foreground"
        )}
      >
        {isUser ? <UserRound className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div className={cn("max-w-[88%] min-w-0 space-y-2", isUser && "items-end text-right")}>
        <div className={cn("flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground", isUser && "justify-end")}>
          <span className="font-semibold text-foreground/85">{isUser ? "Parent" : "Copilot"}</span>
          <span>{createdAtLabel}</span>
        </div>
        <div
          className={cn(
            "rounded-[1.4rem] border px-4 py-3.5 text-sm leading-7 break-words shadow-[var(--shadow-soft)]",
            isUser
              ? "border-primary/18 bg-primary/10 text-foreground"
              : "border-border/70 bg-[var(--glass-panel)] text-foreground"
          )}
        >
          {isAssistant ? (
            <MarkdownContent
              content={renderableContent}
              className="[&_ol]:mt-3 [&_p]:leading-7 [&_pre]:max-w-full [&_ul]:mt-3"
            />
          ) : (
            <div className="whitespace-pre-wrap">{renderableContent}</div>
          )}
        </div>
      </div>
    </div>
  );
}
