"use client";

import { useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Layers3,
  ShieldAlert,
  Target,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoadmapSkill } from "@/lib/curriculum/roadmap-model";
import type { CurriculumTree as CurriculumTreeData, CurriculumTreeNode } from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";

interface CurriculumTreeProps {
  tree: CurriculumTreeData;
  skillById?: Record<string, RoadmapSkill>;
  visibleSkillIds?: Set<string>;
  selectedSkillId?: string | null;
  onSelectSkill?: (skillId: string) => void;
  onJumpToRoadmap?: (skillId: string) => void;
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

function roleLabel(value: RoadmapSkill["instructionalRole"]) {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

function buildInitialExpandedIds(tree: CurriculumTreeData) {
  const ids = new Set<string>();

  function visit(node: CurriculumTreeNode, depth: number) {
    if (depth < 2 && node.children.length > 0) {
      ids.add(node.id);
    }

    for (const child of node.children) {
      visit(child, depth + 1);
    }
  }

  for (const root of tree.rootNodes) {
    visit(root, 0);
  }

  return ids;
}

function buildVisibleSkillCountMap(tree: CurriculumTreeData, visibleSkillIds?: Set<string>) {
  const counts = new Map<string, number>();

  function visit(node: CurriculumTreeNode): number {
    if (node.normalizedType === "skill") {
      const count = !visibleSkillIds || visibleSkillIds.has(node.id) ? 1 : 0;
      counts.set(node.id, count);
      return count;
    }

    const total = node.children.reduce((sum, child) => sum + visit(child), 0);
    counts.set(node.id, total);
    return total;
  }

  for (const root of tree.rootNodes) {
    visit(root);
  }

  return counts;
}

function LegacyNodeRow({
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
            <LegacyNodeRow
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

function StructureNodeRow({
  node,
  depth,
  countsByNodeId,
  expandedIds,
  onToggle,
  skillById,
  selectedSkillId,
  onSelectSkill,
  onJumpToRoadmap,
}: {
  node: CurriculumTreeNode;
  depth: number;
  countsByNodeId: Map<string, number>;
  expandedIds: Set<string>;
  onToggle: (nodeId: string) => void;
  skillById: Record<string, RoadmapSkill>;
  selectedSkillId: string | null;
  onSelectSkill?: (skillId: string) => void;
  onJumpToRoadmap?: (skillId: string) => void;
}) {
  const visibleSkillCount = countsByNodeId.get(node.id) ?? 0;
  if (visibleSkillCount === 0) {
    return null;
  }

  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const Icon = typeIcon[node.normalizedType];

  if (node.normalizedType === "skill") {
    const skill = skillById[node.id];
    if (!skill) return null;

    return (
      <div className="min-w-0" style={{ marginLeft: `${depth * 14}px` }}>
        <div
          className={cn(
            "rounded-[1.15rem] border px-4 py-3",
            selectedSkillId === skill.id
              ? "border-primary/35 bg-primary/6 shadow-[var(--shadow-active)]"
              : "border-border/70 bg-background/84",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{skill.title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{skill.breadcrumb}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{typeLabel[node.normalizedType]}</Badge>
                {skill.phaseTitle ? <Badge variant="secondary">{skill.phaseTitle}</Badge> : null}
                {skill.instructionalRole ? <Badge variant="outline">{roleLabel(skill.instructionalRole)}</Badge> : null}
                {skill.unitTitle ? <Badge variant="outline">{skill.unitTitle}</Badge> : null}
                {skill.launchSlice.included ? <Badge variant="outline">Opening slice</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {skill.requiresAdultSupport ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1">
                    <UserRound className="size-3.5" />
                    Adult support
                  </span>
                ) : null}
                {skill.safetyCritical ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1">
                    <ShieldAlert className="size-3.5" />
                    Safety
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onJumpToRoadmap && skill.phaseTitle ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onJumpToRoadmap(skill.id)}>
                  Show in roadmap
                  <ArrowRight className="size-4" />
                </Button>
              ) : null}
              {onSelectSkill ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onSelectSkill(skill.id)}>
                  Inspect skill
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => onToggle(node.id)}
        className="flex w-full items-start gap-3 rounded-[1.15rem] border border-border/70 bg-card/70 px-4 py-3 text-left transition-[transform,background-color,border-color,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-standard)] hover:-translate-y-px hover:bg-card hover:shadow-[var(--shadow-soft)]"
        style={{ marginLeft: `${depth * 14}px` }}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/80">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{node.title}</p>
            <Badge variant="outline">{typeLabel[node.normalizedType]}</Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {visibleSkillCount} skill{visibleSkillCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{node.normalizedPath}</p>
        </div>
      </button>

      {expanded ? (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <StructureNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              countsByNodeId={countsByNodeId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              skillById={skillById}
              selectedSkillId={selectedSkillId}
              onSelectSkill={onSelectSkill}
              onJumpToRoadmap={onJumpToRoadmap}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CurriculumTree({
  tree,
  skillById,
  visibleSkillIds,
  selectedSkillId = null,
  onSelectSkill,
  onJumpToRoadmap,
}: CurriculumTreeProps) {
  const [expandedIds, setExpandedIds] = useState(() => buildInitialExpandedIds(tree));

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

  if (!skillById) {
    return (
      <div className="space-y-2">
        {tree.rootNodes.map((node) => (
          <LegacyNodeRow
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

  const countsByNodeId = buildVisibleSkillCountMap(tree, visibleSkillIds);

  return (
    <div className="space-y-3">
      {tree.rootNodes.map((node) => (
        <StructureNodeRow
          key={node.id}
          node={node}
          depth={0}
          countsByNodeId={countsByNodeId}
          expandedIds={expandedIds}
          onToggle={onToggle}
          skillById={skillById}
          selectedSkillId={selectedSkillId}
          onSelectSkill={onSelectSkill}
          onJumpToRoadmap={onJumpToRoadmap}
        />
      ))}
    </div>
  );
}
