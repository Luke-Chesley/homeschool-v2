"use client";

import * as React from "react";
import { AlertCircle, BookOpen, Calendar, CheckCircle, FileText, Loader2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CopilotAction, CopilotActionKind } from "@/lib/ai/types";

const kindConfig: Record<
  CopilotActionKind,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  "planning.adjust_day_load": { label: "Adjust day load", Icon: Calendar },
  "planning.defer_or_move_item": { label: "Move route item", Icon: Calendar },
  "planning.generate_today_lesson": { label: "Generate today lesson", Icon: BookOpen },
  "tracking.record_note": { label: "Record note", Icon: FileText },
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
  const isApplying = action.status === "applying";
  const isApplied = action.status === "applied";
  const isFailed = action.status === "failed";
  const isDismissed = action.status === "dismissed";
  const canApply = isPending || isFailed;

  function renderSummary() {
    switch (action.kind) {
      case "planning.adjust_day_load":
      case "planning.defer_or_move_item":
        return action.payload.targetDate == null
          ? "This will defer the selected weekly route item."
          : `This will move the selected weekly route item to ${action.payload.targetDate}.`;
      case "planning.generate_today_lesson":
        return `This will build the lesson draft for ${action.payload.date}.`;
      case "tracking.record_note":
        return `This will save a ${action.payload.noteType.replaceAll("_", " ")} note to tracking.`;
    }
  }

  return (
    <Card
      variant="glass"
      className={cn(
        "overflow-hidden transition-opacity",
        isDismissed && "opacity-40"
      )}
    >
      <CardContent className="flex items-start gap-4 px-5 py-5">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/75 text-primary shadow-[var(--shadow-soft)]">
          <Icon className="size-4 shrink-0" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {config.label}
            </p>
            <Badge variant={isApplied ? "success" : isFailed ? "warning" : "glass"}>
              {action.status.replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{action.label}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">{renderSummary()}</p>
          {action.rationale ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Why this is suggested: {action.rationale}
            </p>
          ) : null}
          {action.requiresApproval ? (
            <p className="mt-2 text-xs font-medium text-foreground/80">
              Parent approval required before Assistant can apply this change.
            </p>
          ) : null}
          {action.result?.message ? (
            <p className="mt-3 text-xs font-medium text-[color:var(--success)]">{action.result.message}</p>
          ) : null}
          {action.error ? (
            <p className="mt-3 flex items-start gap-2 text-xs font-medium text-destructive">
              <AlertCircle className="mt-0.5 size-3 shrink-0" />
              <span>{action.error}</span>
            </p>
          ) : null}
        </div>
        {(isPending || isFailed) && (
          <div className="flex items-center gap-1 shrink-0">
            {onApply && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 rounded-full px-3 text-xs"
                onClick={() => onApply(action)}
                disabled={!canApply}
              >
                <CheckCircle className="size-3" />
                {isFailed ? "Try again" : "Apply"}
              </Button>
            )}
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => onDismiss(action)}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        )}
        {isApplying && (
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground shrink-0">
            <Loader2 className="size-3 animate-spin" />
            Applying
          </span>
        )}
        {isApplied && (
          <span className="text-xs font-medium text-[color:var(--success)] shrink-0">Applied</span>
        )}
        {isDismissed && (
          <span className="text-xs font-medium text-muted-foreground shrink-0">Dismissed</span>
        )}
      </CardContent>
    </Card>
  );
}
