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
    <div className="flex items-end gap-2 rounded-lg border border-input bg-background px-3 py-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Ask the copilot anything…"}
        disabled={disabled}
        rows={1}
        className={cn(
          "flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground",
          "max-h-40 leading-relaxed"
        )}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="shrink-0 size-9"
      >
        <Send className="size-4" />
      </Button>
    </div>
  );
}
