"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Network, Waypoints } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CurriculumRoadmapModel } from "@/lib/curriculum/roadmap-model";
import type {
  ProgressionEdgeKind,
  ProgressionGraph,
  ProgressionGraphEdge,
  ProgressionGraphNode,
} from "@/lib/curriculum/progression-graph-model";
import { cn } from "@/lib/utils";

const NODE_W = 188;
const NODE_H = 72;
const COL_GAP = 72;
const ROW_GAP = 12;
const PAD_X = 24;
const PAD_Y = 30;
const DOMAIN_PAD = 8;
const DOMAIN_LABEL_H = 20;

interface NodePosition {
  id: string;
  x: number;
  y: number;
}

interface DomainBand {
  domainId: string;
  domainTitle: string;
  colIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutResult {
  nodePositions: Map<string, NodePosition>;
  domainBands: DomainBand[];
  totalWidth: number;
  totalHeight: number;
}

interface CurriculumProgressionGraphProps {
  graph: ProgressionGraph;
  roadmap: CurriculumRoadmapModel;
  selectedDomainId?: string | "all";
  selectedSkillId?: string | null;
  onSelectSkill?: (skillId: string) => void;
}

const DOMAIN_COLORS = [
  { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)", label: "#a16207" },
  { bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.25)", label: "#0369a1" },
  { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.22)", label: "#166534" },
  { bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.22)", label: "#7e22ce" },
  { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.22)", label: "#c2410c" },
];

function domainColor(index: number) {
  return DOMAIN_COLORS[index % DOMAIN_COLORS.length];
}

function edgeStyle(kind: ProgressionEdgeKind) {
  switch (kind) {
    case "hardPrerequisite":
      return { stroke: "hsl(var(--foreground))", strokeWidth: 2, strokeDasharray: undefined, opacity: 0.72 };
    case "recommendedBefore":
      return { stroke: "hsl(var(--primary))", strokeWidth: 1.5, strokeDasharray: "6 3", opacity: 0.62 };
    case "revisitAfter":
      return { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5, strokeDasharray: "3 4", opacity: 0.48 };
    case "coPractice":
      return { stroke: "hsl(var(--primary))", strokeWidth: 1.2, strokeDasharray: "2 3", opacity: 0.42 };
    case "explicit":
      return { stroke: "hsl(var(--primary))", strokeWidth: 1.5, strokeDasharray: undefined, opacity: 0.55 };
    case "inferred":
    default:
      return { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.28 };
  }
}

function edgeLegendLabel(kind: ProgressionEdgeKind) {
  switch (kind) {
    case "hardPrerequisite":
      return "Hard prerequisite";
    case "recommendedBefore":
      return "Recommended before";
    case "revisitAfter":
      return "Revisit after";
    case "coPractice":
      return "Co-practice";
    case "explicit":
      return "Explicit";
    case "inferred":
    default:
      return "Inferred";
  }
}

function buildEdgePath(from: NodePosition, to: NodePosition) {
  const startX = from.x + NODE_W;
  const startY = from.y + NODE_H / 2;
  const endX = to.x;
  const endY = to.y + NODE_H / 2;
  const ctrl = Math.max((endX - startX) * 0.45, 24);
  return `M ${startX} ${startY} C ${startX + ctrl} ${startY}, ${endX - ctrl} ${endY}, ${endX} ${endY}`;
}

function computeLayout(graph: ProgressionGraph): LayoutResult {
  const nodePositions = new Map<string, NodePosition>();
  const domainBands: DomainBand[] = [];
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const domainOrder = new Map<string, number>();
  graph.groups.forEach((group, index) => domainOrder.set(group.domainId, index));

  let maxX = 0;
  let maxY = 0;

  for (const column of graph.columns) {
    const colX = PAD_X + column.index * (NODE_W + COL_GAP);
    let curY = PAD_Y;

    const byDomain = new Map<string, string[]>();
    const domainIds: string[] = [];
    for (const nodeId of column.nodeIds) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      if (!byDomain.has(node.domainId)) {
        byDomain.set(node.domainId, []);
        domainIds.push(node.domainId);
      }
      byDomain.get(node.domainId)!.push(nodeId);
    }

    for (const domainId of domainIds) {
      const skillIds = byDomain.get(domainId) ?? [];
      const startY = curY;
      curY += DOMAIN_LABEL_H + DOMAIN_PAD;

      for (const skillId of skillIds) {
        nodePositions.set(skillId, { id: skillId, x: colX, y: curY });
        curY += NODE_H + ROW_GAP;
        maxX = Math.max(maxX, colX + NODE_W);
        maxY = Math.max(maxY, curY);
      }

      domainBands.push({
        domainId,
        domainTitle: graph.groups.find((group) => group.domainId === domainId)?.domainTitle ?? domainId,
        colIndex: column.index,
        x: colX - DOMAIN_PAD,
        y: startY,
        width: NODE_W + DOMAIN_PAD * 2,
        height: Math.max(curY - startY - ROW_GAP, NODE_H + DOMAIN_LABEL_H + DOMAIN_PAD * 2),
      });

      curY += DOMAIN_PAD;
    }
  }

  return {
    nodePositions,
    domainBands,
    totalWidth: maxX + PAD_X,
    totalHeight: maxY + PAD_Y,
  };
}

function projectGraphSubset(graph: ProgressionGraph, visibleIds: Set<string>): ProgressionGraph {
  const originalNodes = graph.nodes.filter((node) => visibleIds.has(node.id));
  const visibleColumns = graph.columns
    .map((column) => ({
      ...column,
      nodeIds: column.nodeIds.filter((nodeId) => visibleIds.has(nodeId)),
    }))
    .filter((column) => column.nodeIds.length > 0);

  const columnIndexMap = new Map<number, number>();
  visibleColumns.forEach((column, index) => columnIndexMap.set(column.index, index));

  const nodes = originalNodes.map((node) => ({
    ...node,
    columnIndex: columnIndexMap.get(node.columnIndex) ?? 0,
  }));

  const columns = visibleColumns.map((column, index) => ({
    ...column,
    index,
  }));

  const edges = graph.edges.filter((edge) => visibleIds.has(edge.fromId) && visibleIds.has(edge.toId));
  const groups = [...new Map(
    nodes.map((node) => [
      node.domainId,
      {
        domainId: node.domainId,
        domainTitle: node.domainTitle,
        sequenceIndex: node.canonicalOrder,
        nodeIds: nodes.filter((candidate) => candidate.domainId === node.domainId).map((candidate) => candidate.id),
      },
    ]),
  ).values()];

  return {
    ...graph,
    nodes,
    edges,
    columns,
    groups,
    hasAnyNodes: nodes.length > 0,
  };
}

function buildAdjacency(edges: ProgressionGraphEdge[]) {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    const fromList = adjacency.get(edge.fromId) ?? new Set<string>();
    fromList.add(edge.toId);
    adjacency.set(edge.fromId, fromList);

    const toList = adjacency.get(edge.toId) ?? new Set<string>();
    toList.add(edge.fromId);
    adjacency.set(edge.toId, toList);
  }

  return adjacency;
}

function buildNeighborhoodIds(graph: ProgressionGraph, skillId: string, hops: 1 | 2) {
  const adjacency = buildAdjacency(graph.edges);
  const visited = new Set<string>([skillId]);
  let frontier = new Set<string>([skillId]);

  for (let depth = 0; depth < hops; depth += 1) {
    const next = new Set<string>();
    for (const current of frontier) {
      const neighbors = adjacency.get(current) ?? new Set<string>();
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        next.add(neighbor);
      }
    }
    frontier = next;
  }

  return visited;
}

function inspectorControlClassName() {
  return "h-10 w-full rounded-xl border border-border/70 bg-background/80 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/70";
}

function EmptyInspectorState() {
  return (
    <Card className="rounded-[1.5rem] border-dashed border-border/80">
      <CardContent className="space-y-3 px-5 py-6">
        <div className="flex items-center gap-2 text-foreground">
          <Network className="size-4" />
          <p className="text-sm font-semibold">Inspect dependencies locally</p>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Choose a phase to see the relationships inside that slice, or pick a skill to inspect a one-hop or
          two-hop neighborhood. The dependencies view is intentionally local so the graph never starts as a
          full-curriculum tangle.
        </p>
      </CardContent>
    </Card>
  );
}

function EdgeLegend({ kinds }: { kinds: ProgressionEdgeKind[] }) {
  if (kinds.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {kinds.map((kind) => {
        const style = edgeStyle(kind);
        return (
          <div key={kind} className="flex items-center gap-1.5">
            <svg width="24" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="24"
                y2="4"
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                opacity={style.opacity * 1.3}
              />
            </svg>
            <span>{edgeLegendLabel(kind)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CurriculumProgressionGraph({
  graph,
  roadmap,
  selectedDomainId = "all",
  selectedSkillId = null,
  onSelectSkill,
}: CurriculumProgressionGraphProps) {
  const [focusMode, setFocusMode] = useState<"skill" | "phase">("skill");
  const [focusSkillId, setFocusSkillId] = useState<string>("");
  const [focusPhaseId, setFocusPhaseId] = useState<string>("");
  const [hopDepth, setHopDepth] = useState<1 | 2>(1);

  useEffect(() => {
    if (!selectedSkillId) return;
    if (!roadmap.skillById[selectedSkillId]) return;
    setFocusMode("skill");
    setFocusSkillId(selectedSkillId);
  }, [roadmap.skillById, selectedSkillId]);

  const filteredSkillOptions = useMemo(
    () =>
      roadmap.skills.filter((skill) => selectedDomainId === "all" || skill.domainId === selectedDomainId),
    [roadmap.skills, selectedDomainId],
  );

  const phaseOptions = useMemo(
    () =>
      roadmap.phases.filter((phase) =>
        phase.groups.some((group) =>
          group.skillIds.some((skillId) => {
            const skill = roadmap.skillById[skillId];
            return selectedDomainId === "all" || skill?.domainId === selectedDomainId;
          }),
        ),
      ),
    [roadmap.phases, roadmap.skillById, selectedDomainId],
  );

  const visibleIds = useMemo(() => {
    if (focusMode === "skill") {
      if (!focusSkillId) return null;
      const neighborhood = buildNeighborhoodIds(graph, focusSkillId, hopDepth);
      return new Set(
        [...neighborhood].filter((skillId) => {
          const skill = roadmap.skillById[skillId];
          return selectedDomainId === "all" || skill?.domainId === selectedDomainId;
        }),
      );
    }

    if (!focusPhaseId) return null;
    const phaseSkillIds = roadmap.skills
      .filter((skill) => skill.phaseId === focusPhaseId)
      .filter((skill) => selectedDomainId === "all" || skill.domainId === selectedDomainId)
      .map((skill) => skill.id);
    return new Set(phaseSkillIds);
  }, [focusMode, focusPhaseId, focusSkillId, graph, hopDepth, roadmap.skillById, roadmap.skills, selectedDomainId]);

  const subset = visibleIds && visibleIds.size > 0 ? projectGraphSubset(graph, visibleIds) : null;
  const layout = subset ? computeLayout(subset) : null;
  const nodeMap = subset ? new Map(subset.nodes.map((node) => [node.id, node])) : new Map<string, ProgressionGraphNode>();
  const edgeKindsPresent = subset ? [...new Set(subset.edges.map((edge) => edge.kind))] as ProgressionEdgeKind[] : [];

  const focusSummary =
    focusMode === "skill"
      ? focusSkillId
        ? `${hopDepth}-hop neighborhood around ${roadmap.skillById[focusSkillId]?.title ?? "selected skill"}`
        : null
      : focusPhaseId
        ? `Dependencies inside ${roadmap.phases.find((phase) => phase.id === focusPhaseId)?.title ?? "selected phase"}`
        : null;

  return (
    <div className="space-y-4">
      <Card className="rounded-[1.5rem] border-border/70 bg-card/72">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Dependencies</Badge>
            <Badge variant="outline">
              {selectedDomainId === "all"
                ? "All domains"
                : roadmap.filters.domains.find((domain) => domain.id === selectedDomainId)?.title ?? "Scoped domain"}
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-[auto_auto_minmax(14rem,1fr)_minmax(14rem,1fr)]">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={focusMode === "skill" ? "default" : "outline"}
                onClick={() => setFocusMode("skill")}
              >
                Skill neighborhood
              </Button>
              <Button
                type="button"
                size="sm"
                variant={focusMode === "phase" ? "default" : "outline"}
                onClick={() => setFocusMode("phase")}
              >
                Whole phase
              </Button>
            </div>

            {focusMode === "skill" ? (
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={hopDepth === 1 ? "default" : "outline"} onClick={() => setHopDepth(1)}>
                  1 hop
                </Button>
                <Button type="button" size="sm" variant={hopDepth === 2 ? "default" : "outline"} onClick={() => setHopDepth(2)}>
                  2 hops
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 text-sm text-muted-foreground">
                <Waypoints className="size-4" />
                Show the full phase slice
              </div>
            )}

            {focusMode === "skill" ? (
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Skill
                </span>
                <select
                  value={focusSkillId}
                  onChange={(event) => setFocusSkillId(event.target.value)}
                  className={inspectorControlClassName()}
                >
                  <option value="">Choose a skill</option>
                  {filteredSkillOptions.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Phase
                </span>
                <select
                  value={focusPhaseId}
                  onChange={(event) => setFocusPhaseId(event.target.value)}
                  className={inspectorControlClassName()}
                >
                  <option value="">Choose a phase</option>
                  {phaseOptions.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Inspector note</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Click a node to open the shared skill detail drawer. This view stays intentionally scoped.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!subset || !layout ? (
        <EmptyInspectorState />
      ) : (
        <Card className="overflow-hidden rounded-[1.5rem] border-border/70">
          <CardContent className="space-y-4 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/25 px-5 py-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{focusSummary}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {subset.nodes.length} skills · {subset.edges.length} dependency links
                </p>
              </div>
              {subset.edges.length === 0 ? (
                <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
                  <Info className="size-3.5" />
                  No explicit dependency edges in this slice
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto px-4 pb-4">
              <div
                className="relative rounded-[1.25rem] border border-border/70 bg-background/70"
                style={{
                  width: Math.max(layout.totalWidth, 700),
                  height: Math.max(layout.totalHeight, 340),
                }}
              >
                {layout.domainBands.map((band, index) => {
                  const color = domainColor(index);
                  return (
                    <div
                      key={`${band.domainId}-${band.colIndex}`}
                      className="absolute rounded-xl"
                      style={{
                        left: band.x,
                        top: band.y,
                        width: band.width,
                        height: band.height,
                        backgroundColor: color.bg,
                        border: `1px solid ${color.border}`,
                      }}
                    >
                      <span
                        className="block truncate px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: color.label }}
                      >
                        {band.domainTitle}
                      </span>
                    </div>
                  );
                })}

                <svg
                  className="pointer-events-none absolute inset-0"
                  width={layout.totalWidth}
                  height={layout.totalHeight}
                  aria-hidden="true"
                >
                  {subset.edges.map((edge) => {
                    const from = layout.nodePositions.get(edge.fromId);
                    const to = layout.nodePositions.get(edge.toId);
                    if (!from || !to) return null;
                    const style = edgeStyle(edge.kind);
                    return (
                      <path
                        key={`${edge.fromId}-${edge.toId}-${edge.kind}`}
                        d={buildEdgePath(from, to)}
                        fill="none"
                        stroke={style.stroke}
                        strokeWidth={style.strokeWidth}
                        strokeDasharray={style.strokeDasharray}
                        opacity={style.opacity}
                        strokeLinecap="round"
                      />
                    );
                  })}
                </svg>

                {subset.nodes.map((node) => {
                  const position = layout.nodePositions.get(node.id);
                  if (!position) return null;

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        if (focusMode === "skill") {
                          setFocusSkillId(node.id);
                        }
                        onSelectSkill?.(node.id);
                      }}
                      className="absolute flex flex-col justify-center gap-0.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-left text-xs shadow-sm transition-[border-color,box-shadow,transform] duration-[var(--motion-base)] ease-[var(--ease-standard)] hover:-translate-y-px hover:border-border hover:shadow-[var(--shadow-soft)]"
                      style={{
                        left: position.x,
                        top: position.y,
                        width: NODE_W,
                        height: NODE_H,
                      }}
                    >
                      <p className="line-clamp-2 font-medium leading-4 text-foreground">{node.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{node.phaseTitle ?? node.domainTitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {edgeKindsPresent.length > 0 ? (
              <div className="border-t border-border/60 bg-muted/20 px-5 py-4">
                <EdgeLegend kinds={edgeKindsPresent} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
