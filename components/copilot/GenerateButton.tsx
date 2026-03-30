"use client";

/**
 * GenerateButton — triggers an async AI generation job.
 *
 * Shows a loading state while the job is dispatched and displays
 * a success/error message. The caller provides the task name and inputs.
 *
 * Integration point: connect to Inngest job status polling once the
 * job processing pipeline is implemented.
 */

import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiTaskName } from "@/lib/ai/types";

interface Props {
  taskName: AiTaskName;
  inputs: Record<string, unknown>;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  onJobDispatched?: (jobId: string) => void;
  onError?: (error: string) => void;
}

export function GenerateButton({
  taskName,
  inputs,
  label = "Generate with AI",
  variant = "outline",
  size = "sm",
  onJobDispatched,
  onError,
}: Props) {
  const [dispatching, setDispatching] = React.useState(false);
  const [dispatched, setDispatched] = React.useState(false);

  async function handleClick() {
    setDispatching(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName, inputs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setDispatched(true);
      onJobDispatched?.(data.jobId);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDispatching(false);
    }
  }

  if (dispatched) {
    return (
      <Button size={size} variant={variant} disabled className="gap-1.5">
        <Sparkles className="size-3.5 text-primary" />
        Generating…
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleClick}
      disabled={dispatching}
      className="gap-1.5"
    >
      {dispatching ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Sparkles className="size-3.5" />
      )}
      {dispatching ? "Dispatching…" : label}
    </Button>
  );
}
