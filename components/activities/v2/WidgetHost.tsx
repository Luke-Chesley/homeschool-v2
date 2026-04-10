"use client";

import * as React from "react";
import type { ComponentRendererProps } from "./types";
import type { InteractiveWidgetComponent } from "@/lib/activities/widgets";
import { renderWidgetSurface } from "./surfaces/SurfaceRegistry";

export interface WidgetHostProps extends ComponentRendererProps<InteractiveWidgetComponent> {}

export function WidgetHost(props: WidgetHostProps) {
  return renderWidgetSurface(props);
}

