"use client";

import { useState } from "react";
import { Network, Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CurriculumTree as CurriculumTreeData } from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";

import { CurriculumFlowMap } from "./curriculum-flow-map";
import { CurriculumTree } from "./curriculum-tree";

interface CurriculumVisualizationPanelProps {
  tree: CurriculumTreeData;
}

type VisualizationMode = "flow" | "tree";

const modeCopy: Record<
  VisualizationMode,
  {
    title: string;
    description: string;
  }
> = {
  flow: {
    title: "Flow map",
    description: "Visualize the curriculum as an ordered knowledge map from broad domains down to individual skills.",
  },
  tree: {
    title: "Tree view",
    description: "Inspect the same canonical hierarchy in a compact expandable list.",
  },
};

export function CurriculumVisualizationPanel({ tree }: CurriculumVisualizationPanelProps) {
  const [mode, setMode] = useState<VisualizationMode>("flow");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/70 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{modeCopy[mode].title}</p>
          <p className="text-sm text-muted-foreground">{modeCopy[mode].description}</p>
        </div>
        <div className="inline-flex w-full rounded-full border border-border/70 bg-card/80 p-1 lg:w-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMode("flow")}
            className={cn(
              "flex-1 rounded-full lg:flex-none",
              mode === "flow" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
            )}
          >
            <Network className="size-4" />
            Flow map
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMode("tree")}
            className={cn(
              "flex-1 rounded-full lg:flex-none",
              mode === "tree" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
            )}
          >
            <Rows3 className="size-4" />
            Tree view
          </Button>
        </div>
      </div>

      {mode === "flow" ? <CurriculumFlowMap tree={tree} /> : <CurriculumTree tree={tree} />}
    </div>
  );
}
