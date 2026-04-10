"use client";

import * as React from "react";
import type { ComponentRendererProps } from "../types";
import type { InteractiveWidgetComponent, WidgetSurfaceKind } from "@/lib/activities/widgets";
import { BoardSurface } from "./BoardSurface";
import { ExpressionSurface } from "./ExpressionSurface";
import { GraphSurface } from "./GraphSurface";

type WidgetRenderer = (
  props: ComponentRendererProps<InteractiveWidgetComponent>,
) => React.ReactElement | null;

const SURFACE_REGISTRY: Partial<Record<WidgetSurfaceKind, WidgetRenderer>> = {
  board_surface: (props) => <BoardSurface {...props} />,
  expression_surface: (props) => <ExpressionSurface {...props} />,
  graph_surface: (props) => <GraphSurface {...props} />,
};

export function renderWidgetSurface(
  props: ComponentRendererProps<InteractiveWidgetComponent>,
): React.ReactElement {
  const renderer = SURFACE_REGISTRY[props.spec.widget.surfaceKind];
  if (!renderer) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
        Unknown widget surface: {props.spec.widget.surfaceKind}
      </div>
    );
  }

  return renderer(props) ?? (
    <div className="rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
      Widget surface error: {props.spec.widget.surfaceKind}
    </div>
  );
}

