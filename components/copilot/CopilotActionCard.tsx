"use client";

import * as React from "react";
import { CheckCircle, X, BookOpen, Calendar, FileText, Target, BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CopilotAction, CopilotActionKind } from "@/lib/ai/types";

const kindConfig: Record<
  CopilotActionKind,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  "plan.add_lesson": { label: "Add lesson to plan", Icon: Calendar },
  "plan.adjust_schedule": { label: "Adjust schedule", Icon: Calendar },
  "artifact.create": { label: "Create artifact", Icon: FileText },
  "recommendation.create": { label: "Curriculum recommendation", Icon: BookMarked },
  "standards.map": { label: "Map standards", Icon: Target },
};

interface Props {
  action: CopilotAction;
  onApply?: (action: CopilotAction) => void;
  onDismiss?: (action: CopilotAction) => void;
}

export function CopilotActionCard({ action, onApply, onDismiss }: Props) {
  const config = kindConfig[action.kind] ?? { label: action.kind, Icon: BookOpen };
  const { Icon } = config;

  const isPending = action.status === "pending";
  const isApplied = action.status === "applied";
  const isDismissed = action.status === "dismissed";

  return (
    <Card
      className={cn(
        "transition-opacity",
        isDismissed && "opacity-40"
      )}
    >
      <CardContent className="flex items-start gap-3 py-3 px-4">
        <Icon className="size-4 shrink-0 text-primary/70 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {config.label}
          </p>
          <p className="text-sm mt-0.5">{action.label}</p>
        </div>
        {isPending && (
          <div className="flex items-center gap-1 shrink-0">
            {onApply && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => onApply(action)}
              >
                <CheckCircle className="size-3" />
                Apply
              </Button>
            )}
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => onDismiss(action)}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        )}
        {isApplied && (
          <span className="text-xs text-emerald-600 font-medium shrink-0">Applied</span>
        )}
      </CardContent>
    </Card>
  );
}
