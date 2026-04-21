"use client";

import { useState } from "react";
import { BookOpenText, ChevronDown, ChevronRight, FolderTree, Layers3, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CurriculumTree as CurriculumTreeData, CurriculumTreeNode } from "@/lib/curriculum/types";

interface CurriculumTreeProps {
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

function CurriculumNodeRow({
  node,
  depth,
  expandedIds,
  onToggle,
}: {
  node: CurriculumTreeNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (nodeId: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const Icon = typeIcon[node.normalizedType];
  const isSkill = node.normalizedType === "skill";

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={hasChildren ? () => onToggle(node.id) : undefined}
        className={cn(
          "flex w-full items-start gap-3 rounded-[calc(var(--radius)-0.1rem)] px-3 py-2.5 text-left transition-[transform,background-color,border-color,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-standard)]",
          hasChildren ? "hover:-translate-y-px hover:bg-card/82 hover:shadow-[var(--shadow-soft)]" : "cursor-default",
          isSkill ? "border border-primary/20 bg-primary/6" : "border border-transparent",
        )}
        style={{ marginLeft: `${depth * 14}px` }}
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

        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/76",
            isSkill && "border-primary/20 bg-primary/10 text-primary",
          )}
        >
          <Icon className={cn("size-4 shrink-0", isSkill ? "text-primary" : "text-muted-foreground")} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("text-sm", isSkill ? "font-semibold" : "font-medium")}>{node.title}</p>
            <Badge variant={isSkill ? "secondary" : "glass"} className="text-[10px] uppercase tracking-[0.14em]">
              {typeLabel[node.normalizedType]}
            </Badge>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{node.normalizedPath}</p>
        </div>
      </button>

      {hasChildren && expanded ? (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <CurriculumNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CurriculumTree({ tree }: CurriculumTreeProps) {
  const [expandedIds, setExpandedIds] = useState(() => new Set(tree.rootNodes.map((node) => node.id)));

  const onToggle = (nodeId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {tree.rootNodes.map((node) => (
        <CurriculumNodeRow
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
