"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type LearnerOption = {
  id: string;
  displayName: string;
  status: string;
};

export function ActiveLearnerSwitcher({
  learners,
  activeLearnerId,
  label = "Active learner",
  className,
  selectClassName,
  labelClassName,
}: {
  learners: LearnerOption[];
  activeLearnerId: string | null;
  label?: string;
  className?: string;
  selectClassName?: string;
  labelClassName?: string;
}) {
  const router = useRouter();
  const [selectedLearnerId, setSelectedLearnerId] = React.useState(activeLearnerId ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedLearnerId(activeLearnerId ?? "");
  }, [activeLearnerId]);

  async function handleChange(nextLearnerId: string) {
    setSelectedLearnerId(nextLearnerId);
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/app-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId: nextLearnerId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Could not switch learners.");
      }

      router.refresh();
    } catch (switchError) {
      setError(
        switchError instanceof Error ? switchError.message : "Could not switch learners.",
      );
      setSelectedLearnerId(activeLearnerId ?? "");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label className={cn("text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground", labelClassName)}>
        {label}
      </label>
      <select
        value={selectedLearnerId}
        onChange={(event) => void handleChange(event.target.value)}
        disabled={pending || learners.length === 0}
        aria-label={label}
        className={cn(
          "min-w-0 max-w-full rounded-lg border border-border/70 bg-background/85 px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60",
          selectClassName,
        )}
        title={learners.find((learner) => learner.id === selectedLearnerId)?.displayName}
      >
        {learners.map((learner) => (
          <option key={learner.id} value={learner.id}>
            {learner.displayName}
            {learner.status !== "active" ? ` (${learner.status})` : ""}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
