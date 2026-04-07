"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CurriculumSource } from "@/lib/curriculum/types";
import type {
  ProgressionGraph,
  ProgressionGraphEdge,
  ProgressionGraphNode,
  ProgressionEdgeKind,
} from "@/lib/curriculum/progression-graph-model";
import { cn } from "@/lib/utils";

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W = 176;
const NODE_H = 64;
const COL_GAP = 80;
const ROW_GAP = 10;
const PAD_X = 24;
const PAD_Y = 32;
const DOMAIN_PAD = 8;
const DOMAIN_LABEL_H = 20;

// ── Types ─────────────────────────────────────────────────────────────────────

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
  colorClass: string;
}

interface LayoutResult {
  nodePositions: Map<string, NodePosition>;
  domainBands: DomainBand[];
  totalWidth: number;
  totalHeight: number;
}

// ── Domain colours ────────────────────────────────────────────────────────────

const DOMAIN_COLORS = [
  { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)", label: "#a16207" },
  { bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.25)", label: "#0369a1" },
  { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.22)", label: "#166534" },
  { bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.22)", label: "#7e22ce" },
  { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.22)", label: "#c2410c" },
  { bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.2)", label: "#9d174d" },
];

function domainColor(index: number) {
  return DOMAIN_COLORS[index % DOMAIN_COLORS.length];
}

// ── Edge styling ───────────────────────────────────────────────────────────────

function edgeStyle(kind: ProgressionEdgeKind): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
} {
  switch (kind) {
    case "hardPrerequisite":
      return { stroke: "hsl(var(--foreground))", strokeWidth: 2, opacity: 0.7 };
    case "recommendedBefore":
      return { stroke: "hsl(var(--primary))", strokeWidth: 1.5, strokeDasharray: "6 3", opacity: 0.6 };
    case "revisitAfter":
      return { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5, strokeDasharray: "3 4", opacity: 0.45 };
    case "coPractice":
      return { stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "2 3", opacity: 0.4 };
    case "explicit":
      return { stroke: "hsl(var(--primary))", strokeWidth: 1.5, opacity: 0.55 };
    case "inferred":
    default:
      return { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.25 };
  }
}

function edgeLegendLabel(kind: ProgressionEdgeKind): string {
  switch (kind) {
    case "hardPrerequisite": return "Hard prerequisite";
    case "recommendedBefore": return "Recommended before";
    case "revisitAfter": return "Revisit after";
    case "coPractice": return "Co-practice";
    case "explicit": return "Explicit";
    case "inferred": return "Inferred sequence";
  }
}

// ── Layout engine ─────────────────────────────────────────────────────────────

function computeLayout(graph: ProgressionGraph): LayoutResult {
  const nodePositions = new Map<string, NodePosition>();
  const domainBands: DomainBand[] = [];

  // Index domain sequence for colours
  const domainIndexMap = new Map<string, number>();
  graph.groups.forEach((g, i) => domainIndexMap.set(g.domainId, i));

  // Get node lookup
  const nodeMap = new Map<string, ProgressionGraphNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);

  let maxX = 0;
  let maxY = 0;

  for (const col of graph.columns) {
    const colX = PAD_X + col.index * (NODE_W + COL_GAP);
    let curY = PAD_Y;

    // Group nodes in this column by domain (preserve sorted order from model)
    const domainOrder: string[] = [];
    const byDomain = new Map<string, string[]>();
    for (const id of col.nodeIds) {
      const n = nodeMap.get(id);
      if (!n) continue;
      if (!byDomain.has(n.domainId)) {
        domainOrder.push(n.domainId);
        byDomain.set(n.domainId, []);
      }
      byDomain.get(n.domainId)!.push(id);
    }

    for (const domainId of domainOrder) {
      const domainNodeIds = byDomain.get(domainId) ?? [];
      const groupStartY = curY;

      // Add domain label height
      curY += DOMAIN_LABEL_H + DOMAIN_PAD;

      for (const id of domainNodeIds) {
        nodePositions.set(id, { id, x: colX, y: curY });
        curY += NODE_H + ROW_GAP;
        maxX = Math.max(maxX, colX + NODE_W);
        maxY = Math.max(maxY, curY);
      }

      const groupHeight = curY - groupStartY - ROW_GAP;
      const colorIdx = domainIndexMap.get(domainId) ?? 0;
      domainBands.push({
        domainId,
        domainTitle: graph.groups.find((g) => g.domainId === domainId)?.domainTitle ?? domainId,
        colIndex: col.index,
        x: colX - DOMAIN_PAD,
        y: groupStartY,
        width: NODE_W + DOMAIN_PAD * 2,
        height: Math.max(groupHeight, NODE_H + DOMAIN_LABEL_H + DOMAIN_PAD * 2),
        colorClass: colorIdx.toString(),
      });

      curY += DOMAIN_PAD; // inter-domain gap
    }
  }

  return {
    nodePositions,
    domainBands,
    totalWidth: maxX + PAD_X,
    totalHeight: maxY + PAD_Y,
  };
}

// ── Edge path ─────────────────────────────────────────────────────────────────

function buildEdgePath(
  from: NodePosition,
  to: NodePosition,
): string {
  const startX = from.x + NODE_W;
  const startY = from.y + NODE_H / 2;
  const endX = to.x;
  const endY = to.y + NODE_H / 2;
  const ctrl = Math.max((endX - startX) * 0.45, 24);
  return `M ${startX} ${startY} C ${startX + ctrl} ${startY}, ${endX - ctrl} ${endY}, ${endX} ${endY}`;
}

// ── Source bar ────────────────────────────────────────────────────────────────

function SourceBar({
  sources,
  selectedSourceId,
}: {
  sources: CurriculumSource[];
  selectedSourceId: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => {
        const selected = source.id === selectedSourceId;
        return (
          <Link
            key={source.id}
            href={`/curriculum/graph?sourceId=${source.id}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              selected
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border/70 bg-background/75 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <span className="font-medium">{source.title}</span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.14em]">
              v{source.importVersion}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

// ── Diagnostics status bar ───────────────────────────────────────────────────

function DiagnosticsBar({ graph }: { graph: ProgressionGraph }) {
  const { diagnostics } = graph;
  const isExplicit = diagnostics.hasExplicitProgression;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 text-sm",
        isExplicit
          ? "border-emerald-400/40 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-amber-400/40 bg-amber-50/60 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
      )}
    >
      {isExplicit ? (
        <CheckCircle2 className="size-4 shrink-0" />
      ) : (
        <AlertTriangle className="size-4 shrink-0" />
      )}
      <span className="font-medium">
        {isExplicit ? "Explicit progression" : "Inferred fallback — no explicit phases"}
      </span>
      <span className="text-xs opacity-70">
        {diagnostics.phaseCount > 0 && `${diagnostics.phaseCount} phases · `}
        {graph.edges.length} edges · {graph.nodes.length} skills
        {diagnostics.droppedEdgeCount > 0 && ` · ${diagnostics.droppedEdgeCount} edges dropped`}
      </span>
    </div>
  );
}

// ── Node detail popover ───────────────────────────────────────────────────────

interface NodeDetailProps {
  node: ProgressionGraphNode;
  inEdges: ProgressionGraphEdge[];
  outEdges: ProgressionGraphEdge[];
  graph: ProgressionGraph;
  onClose: () => void;
}

function NodeDetail({ node, inEdges, outEdges, graph, onClose }: NodeDetailProps) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-border/70 bg-card p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Skill
          </p>
          <p className="text-sm font-semibold leading-5 text-foreground">{node.title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground/70">Domain:</span> {node.domainTitle}
        </div>
        {node.strandTitle && (
          <div>
            <span className="font-medium text-foreground/70">Strand:</span> {node.strandTitle}
          </div>
        )}
        {node.goalGroupTitle && (
          <div>
            <span className="font-medium text-foreground/70">Goal group:</span> {node.goalGroupTitle}
          </div>
        )}
        {node.phaseTitle && (
          <div>
            <span className="font-medium text-foreground/70">Phase:</span> {node.phaseTitle}
          </div>
        )}
        {!node.isExplicitlyPhased && (
          <div className="italic opacity-70">No explicit phase assigned</div>
        )}
      </div>

      {outEdges.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Required before
          </p>
          {outEdges.map((e) => {
            const target = nodeMap.get(e.toId);
            return (
              <div key={e.toId} className="flex items-center gap-2 text-xs">
                <span className="inline-block size-1.5 rounded-full bg-foreground/40" />
                <span className="text-foreground/80">{target?.title ?? e.toId}</span>
                <Badge variant="outline" className="text-[9px] uppercase tracking-[0.12em]">
                  {edgeLegendLabel(e.kind)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {inEdges.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Requires
          </p>
          {inEdges.map((e) => {
            const src = nodeMap.get(e.fromId);
            return (
              <div key={e.fromId} className="flex items-center gap-2 text-xs">
                <span className="inline-block size-1.5 rounded-full bg-foreground/40" />
                <span className="text-foreground/80">{src?.title ?? e.fromId}</span>
                <Badge variant="outline" className="text-[9px] uppercase tracking-[0.12em]">
                  {edgeLegendLabel(e.kind)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Edge legend ───────────────────────────────────────────────────────────────

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
                opacity={style.opacity * 1.4}
              />
            </svg>
            <span>{edgeLegendLabel(kind)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CurriculumProgressionGraphProps {
  sources: CurriculumSource[];
  selectedSourceId: string;
  graph: ProgressionGraph;
}

export function CurriculumProgressionGraph({
  sources,
  selectedSourceId,
  graph,
}: CurriculumProgressionGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset selection when source changes.
  useEffect(() => {
    setSelectedNodeId(null);
  }, [selectedSourceId]);

  const layout = computeLayout(graph);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const domainIndexMap = new Map(graph.groups.map((g, i) => [g.domainId, i]));

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null;
  const inEdges = selectedNodeId
    ? graph.edges.filter((e) => e.toId === selectedNodeId)
    : [];
  const outEdges = selectedNodeId
    ? graph.edges.filter((e) => e.fromId === selectedNodeId)
    : [];

  const edgeKindsPresent = [...new Set(graph.edges.map((e) => e.kind))] as ProgressionEdgeKind[];

  if (!graph.hasAnyNodes) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-sm text-muted-foreground">
            No skills to graph for this curriculum source.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Source selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Curriculum source
        </p>
        <SourceBar sources={sources} selectedSourceId={selectedSourceId} />
      </div>

      {/* Progression status */}
      <DiagnosticsBar graph={graph} />

      {/* Side-by-side: graph + detail panel */}
      <div className={cn("flex gap-4", selectedNode ? "items-start" : "")}>
        {/* Graph canvas */}
        <div className="min-w-0 flex-1">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Column headers */}
              <div
                className="flex border-b border-border/60 bg-muted/30"
                style={{
                  paddingLeft: PAD_X,
                  paddingRight: PAD_X,
                }}
              >
                {graph.columns.map((col) => (
                  <div
                    key={col.index}
                    className="flex shrink-0 items-center gap-2 py-3 pr-4"
                    style={{ width: NODE_W + COL_GAP, minWidth: NODE_W + COL_GAP }}
                  >
                    <span className="text-xs font-semibold text-foreground/70">{col.title}</span>
                    {col.isFallback && (
                      <span title="Inferred order — no explicit phases">
                        <Info className="size-3 text-muted-foreground" />
                      </span>
                    )}
                    <Badge variant="outline" className="ml-auto text-[9px] uppercase tracking-[0.1em]">
                      {col.nodeIds.length}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Scrollable graph area */}
              <div className="overflow-x-auto">
                <div
                  ref={containerRef}
                  className="relative"
                  style={{
                    width: Math.max(layout.totalWidth, 600),
                    height: Math.max(layout.totalHeight, 400),
                  }}
                >
                  {/* Domain band backgrounds */}
                  {layout.domainBands.map((band, i) => {
                    const colIdx = domainIndexMap.get(band.domainId) ?? 0;
                    const color = domainColor(colIdx);
                    return (
                      <div
                        key={`${band.domainId}-${band.colIndex}-${i}`}
                        className="absolute rounded-lg"
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

                  {/* SVG edges */}
                  <svg
                    className="pointer-events-none absolute inset-0"
                    width={layout.totalWidth}
                    height={layout.totalHeight}
                    aria-hidden="true"
                  >
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="6"
                        markerHeight="4"
                        refX="5"
                        refY="2"
                        orient="auto"
                      >
                        <polygon
                          points="0 0, 6 2, 0 4"
                          fill="hsl(var(--muted-foreground))"
                          opacity="0.5"
                        />
                      </marker>
                    </defs>
                    {graph.edges.map((edge) => {
                      const fromPos = layout.nodePositions.get(edge.fromId);
                      const toPos = layout.nodePositions.get(edge.toId);
                      if (!fromPos || !toPos) return null;
                      const style = edgeStyle(edge.kind);
                      const isRelated =
                        selectedNodeId &&
                        (edge.fromId === selectedNodeId || edge.toId === selectedNodeId);
                      const dimmed = selectedNodeId && !isRelated;
                      return (
                        <path
                          key={`${edge.fromId}-${edge.toId}`}
                          d={buildEdgePath(fromPos, toPos)}
                          fill="none"
                          stroke={style.stroke}
                          strokeWidth={isRelated ? style.strokeWidth * 1.8 : style.strokeWidth}
                          strokeDasharray={style.strokeDasharray}
                          opacity={dimmed ? style.opacity * 0.3 : style.opacity * (isRelated ? 1.4 : 1)}
                          strokeLinecap="round"
                          markerEnd="url(#arrowhead)"
                        />
                      );
                    })}
                  </svg>

                  {/* Skill nodes */}
                  {graph.nodes.map((node) => {
                    const pos = layout.nodePositions.get(node.id);
                    if (!pos) return null;
                    const isSelected = node.id === selectedNodeId;
                    const isRelated =
                      selectedNodeId &&
                      !isSelected &&
                      graph.edges.some(
                        (e) =>
                          (e.fromId === selectedNodeId && e.toId === node.id) ||
                          (e.toId === selectedNodeId && e.fromId === node.id),
                      );
                    const dimmed = selectedNodeId && !isSelected && !isRelated;

                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() =>
                          setSelectedNodeId(isSelected ? null : node.id)
                        }
                        className={cn(
                          "absolute flex flex-col justify-center gap-0.5 rounded-xl border px-3 py-2 text-left text-xs transition-all",
                          "bg-card shadow-sm hover:shadow-md",
                          isSelected
                            ? "z-10 border-primary bg-primary/8 shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]"
                            : isRelated
                              ? "border-primary/30 bg-primary/5"
                              : "border-border/60 hover:border-border",
                          dimmed && "opacity-30",
                          !node.isExplicitlyPhased && "border-dashed",
                        )}
                        style={{
                          left: pos.x,
                          top: pos.y,
                          width: NODE_W,
                          height: NODE_H,
                        }}
                      >
                        <p className="line-clamp-2 font-medium leading-4 text-foreground">
                          {node.title}
                        </p>
                        {node.phaseTitle && (
                          <p className="truncate text-[10px] text-muted-foreground">
                            {node.phaseTitle}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Edge legend */}
              {edgeKindsPresent.length > 0 && (
                <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
                  <EdgeLegend kinds={edgeKindsPresent} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Node detail panel */}
        {selectedNode && (
          <div className="w-72 shrink-0">
            <NodeDetail
              node={selectedNode}
              inEdges={inEdges}
              outEdges={outEdges}
              graph={graph}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        )}
      </div>

      {/* Mobile fallback */}
      <div className="md:hidden">
        <Card>
          <CardContent className="py-6">
            <p className="text-center text-sm text-muted-foreground">
              The progression graph is designed for wider screens. Rotate your device or view on
              desktop for the best experience.
            </p>
            <div className="mt-4 space-y-2">
              {graph.columns.map((col) => (
                <div key={col.index}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {col.title}
                  </p>
                  <div className="grid gap-1">
                    {col.nodeIds.map((id) => {
                      const n = nodeMap.get(id);
                      if (!n) return null;
                      return (
                        <div
                          key={id}
                          className="rounded-lg border border-border/60 px-3 py-2 text-xs"
                        >
                          <p className="font-medium">{n.title}</p>
                          <p className="text-muted-foreground">{n.domainTitle}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
