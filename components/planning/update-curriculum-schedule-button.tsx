"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UpdateCurriculumScheduleButtonProps {
  hasChanges: boolean;
  isBusy: boolean;
  onRefresh: () => Promise<void>;
  className?: string;
}

export function UpdateCurriculumScheduleButton({
  hasChanges,
  isBusy,
  onRefresh,
  className,
}: UpdateCurriculumScheduleButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleClick = async () => {
    if (!hasChanges || isBusy || isRefreshing) {
      return;
    }

    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const disabled = !hasChanges || isBusy || isRefreshing;

  return (
    <div className={cn("space-y-2", className)}>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => void handleClick()}>
        {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
        Update curriculum schedule
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        {isRefreshing
          ? "Recomputing the remaining cards from the current order."
          : hasChanges
            ? "Reflow the remaining cards to match the order you set."
            : "Move a card first, then refresh the rest of the schedule."}
      </p>
    </div>
  );
}
