"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, BookOpenText, FolderTree, Layers3, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CurriculumTree as CurriculumTreeData, CurriculumTreeNode } from "@/lib/curriculum/types";

interface TreeProps {
  tree: CurriculumTreeData;
}

const typeIcon = {
  domain: FolderTree,
  strand: Layers3,
  goal_group: BookOpenText,
  skill: Target,
} as const;

const typeLabel = {
  domain: "Domain",
  strand: "Strand",
  goal_group: "Goal Group",
  skill: "Skill",
} as const;

function NodeRow({ node, depth }: { node: CurriculumTreeNode; depth: number }) {
  const [expanded, setExpanded] = React.useState(depth < 2);
  const Icon = typeIcon[node.normalizedType];
  const hasChildren = node.children.length > 0;
  const synthesized = node.metadata.synthesized === true;

  return (
    <div className="min-w-0">
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors",
          "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !hasChildren && "cursor-default hover:bg-transparent",
        )}
        style={{ paddingLeft: `${(depth + 1) * 14}px` }}
        onClick={hasChildren ? () => setExpanded((value) => !value) : undefined}
        aria-expanded={hasChildren ? expanded : undefined}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="mt-1 size-4 shrink-0" />
        )}
        <Icon className="mt-1 size-4 shrink-0 text-primary/70" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-words text-sm font-medium leading-6">{node.title}</span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.18em]">
              {typeLabel[node.normalizedType]}
            </Badge>
            {node.code ? (
              <Badge variant="secondary" className="text-[10px]">
                {node.code}
              </Badge>
            ) : null}
            {synthesized ? (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Synthesized
              </Badge>
            ) : null}
          </div>
          {node.description ? (
            <p className="mt-1 text-xs text-muted-foreground">{node.description}</p>
          ) : null}
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Node ID: <span className="font-mono">{node.id}</span>
          </p>
        </div>
      </button>
      {hasChildren && expanded ? (
        <div>
          {node.children.map((child) => (
            <NodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CurriculumTree({ tree }: TreeProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 py-2">
      {tree.rootNodes.map((node) => (
        <NodeRow key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
