"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div className="space-y-2 rounded-[1.6rem] border border-border/70 bg-[var(--glass-panel)] p-2.5 shadow-[var(--shadow-card)]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Ask about today, this week, or what to do next."}
        disabled={disabled}
        rows={1}
        className={cn(
          "field-shell-textarea min-h-[3.25rem] w-full resize-none rounded-[1.2rem] border-none bg-background/72 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground",
          "max-h-40 leading-6 shadow-none"
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-xs text-muted-foreground">Enter to send.</p>
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className="gap-2 rounded-full px-4"
        >
          <Send className="size-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
