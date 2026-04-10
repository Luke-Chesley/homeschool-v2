"use client";

import * as React from "react";
import type { ComponentRendererProps } from "../types";
import type { InteractiveWidgetComponent } from "@/lib/activities/widgets";

export function ExpressionSurface({ spec }: ComponentRendererProps<InteractiveWidgetComponent>) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-4 text-sm">
      <p className="font-medium text-foreground">{spec.prompt}</p>
      <p className="text-xs text-muted-foreground">
        Expression surface scaffolding is reserved for backend-engine backed math input.
      </p>
    </div>
  );
}

