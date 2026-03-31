"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, BookText, Layers, FileText, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type {
  CurriculumTree as CurriculumTreeData,
  CurriculumUnit,
  CurriculumLesson,
  CurriculumObjective,
} from "@/lib/curriculum/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreeProps {
  tree: CurriculumTreeData;
  onSelectLesson?: (lesson: CurriculumLesson) => void;
  onSelectObjective?: (objective: CurriculumObjective) => void;
}

// ---------------------------------------------------------------------------
// Expandable row primitives
// ---------------------------------------------------------------------------

function ExpandableRow({
  depth = 0,
  expanded,
  onToggle,
  icon: Icon,
  label,
  meta,
  children,
}: {
  depth?: number;
  expanded: boolean;
  onToggle: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        className={cn(
          "flex w-full min-w-0 items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors",
          "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <Icon className="size-4 shrink-0 text-primary/70" />
        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-6 whitespace-normal">
          {label}
        </span>
        {meta}
      </button>
      {expanded && children && <div>{children}</div>}
    </div>
  );
}

function LeafRow({
  depth = 0,
  icon: Icon,
  label,
  onClick,
  tags,
}: {
  depth?: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  tags?: string[];
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      className={cn(
        "flex w-full min-w-0 items-start gap-2 rounded-lg px-3 py-1.5 text-left text-sm",
        "text-foreground/80",
        onClick && "cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      style={{ paddingLeft: `${(depth + 1) * 12}px` }}
      onClick={onClick}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 break-words leading-6 whitespace-normal">{label}</span>
      {tags && tags.length > 0 ? (
        <span className="flex max-w-full flex-wrap justify-end gap-1">
          {tags.map((t) => (
            <Badge key={t} variant="outline" className="max-w-full text-[10px] normal-case tracking-normal whitespace-normal break-all">
              {t}
            </Badge>
          ))}
        </span>
      ) : null}
    </Comp>
  );
}

// ---------------------------------------------------------------------------
// Objective rows
// ---------------------------------------------------------------------------

function ObjectiveRow({
  objective,
  depth,
  onSelect,
}: {
  objective: CurriculumObjective;
  depth: number;
  onSelect?: (obj: CurriculumObjective) => void;
}) {
  return (
    <LeafRow
      depth={depth}
      icon={Target}
      label={objective.description}
      onClick={onSelect ? () => onSelect(objective) : undefined}
      tags={objective.standardIds.slice(0, 2)}
    />
  );
}

// ---------------------------------------------------------------------------
// Lesson rows
// ---------------------------------------------------------------------------

function LessonRow({
  lesson,
  objectives,
  depth,
  onSelectLesson,
  onSelectObjective,
}: {
  lesson: CurriculumLesson;
  objectives: CurriculumObjective[];
  depth: number;
  onSelectLesson?: (lesson: CurriculumLesson) => void;
  onSelectObjective?: (obj: CurriculumObjective) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const hasChildren = objectives.length > 0;

  if (!hasChildren) {
    return (
      <LeafRow
        depth={depth}
        icon={FileText}
        label={lesson.title}
        onClick={onSelectLesson ? () => onSelectLesson(lesson) : undefined}
      />
    );
  }

  return (
    <ExpandableRow
      depth={depth}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      icon={FileText}
      label={lesson.title}
      meta={
        objectives.length > 0 ? (
          <span className="text-xs text-muted-foreground">{objectives.length} obj</span>
        ) : undefined
      }
    >
      {objectives.map((obj) => (
        <ObjectiveRow
          key={obj.id}
          objective={obj}
          depth={depth + 1}
          onSelect={onSelectObjective}
        />
      ))}
    </ExpandableRow>
  );
}

// ---------------------------------------------------------------------------
// Unit rows
// ---------------------------------------------------------------------------

function UnitRow({
  unit,
  lessons,
  unitObjectives,
  depth,
  onSelectLesson,
  onSelectObjective,
}: {
  unit: CurriculumUnit;
  lessons: Array<{ lesson: CurriculumLesson; objectives: CurriculumObjective[] }>;
  unitObjectives: CurriculumObjective[];
  depth: number;
  onSelectLesson?: (lesson: CurriculumLesson) => void;
  onSelectObjective?: (obj: CurriculumObjective) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <ExpandableRow
      depth={depth}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      icon={Layers}
      label={unit.title}
      meta={
        unit.estimatedWeeks ? (
          <span className="text-xs text-muted-foreground">{unit.estimatedWeeks}w</span>
        ) : undefined
      }
    >
      {unitObjectives.map((obj) => (
        <ObjectiveRow
          key={obj.id}
          objective={obj}
          depth={depth + 1}
          onSelect={onSelectObjective}
        />
      ))}
      {lessons.map(({ lesson, objectives }) => (
        <LessonRow
          key={lesson.id}
          lesson={lesson}
          objectives={objectives}
          depth={depth + 1}
          onSelectLesson={onSelectLesson}
          onSelectObjective={onSelectObjective}
        />
      ))}
    </ExpandableRow>
  );
}

// ---------------------------------------------------------------------------
// Root tree
// ---------------------------------------------------------------------------

export function CurriculumTree({ tree, onSelectLesson, onSelectObjective }: TreeProps) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="min-w-0 select-none overflow-hidden rounded-xl border border-border/70 bg-card/80 py-2">
      <ExpandableRow
        depth={0}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        icon={BookText}
        label={tree.source.title}
        meta={
          <span className="text-xs text-muted-foreground">
            {tree.units.length} unit{tree.units.length !== 1 ? "s" : ""}
          </span>
        }
      >
        {tree.units.map(({ unit, lessons, objectives }) => (
          <UnitRow
            key={unit.id}
            unit={unit}
            lessons={lessons}
            unitObjectives={objectives}
            depth={1}
            onSelectLesson={onSelectLesson}
            onSelectObjective={onSelectObjective}
          />
        ))}
      </ExpandableRow>
    </div>
  );
}
