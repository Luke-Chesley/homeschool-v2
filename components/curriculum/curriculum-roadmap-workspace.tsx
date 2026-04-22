"use client";

import Link from "next/link";
import * as React from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { CurriculumExportCard } from "@/components/curriculum/CurriculumExportCard";
import { CurriculumRefinementWidget } from "@/components/curriculum/CurriculumRefinementWidget";
import { ProgressionPromptPreview } from "@/components/curriculum/ProgressionPromptPreview";
import { CurriculumProgressionGraph } from "@/components/curriculum/curriculum-progression-graph";
import { CurriculumRoadmapView } from "@/components/curriculum/curriculum-roadmap-view";
import { CurriculumSkillDrawer } from "@/components/curriculum/curriculum-skill-drawer";
import { CurriculumTree } from "@/components/curriculum/curriculum-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CurriculumRoadmapModel } from "@/lib/curriculum/roadmap-model";
import type { ProgressionGraph } from "@/lib/curriculum/progression-graph-model";
import type { CurriculumSource, CurriculumTree as CurriculumTreeData } from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";

type ViewMode = "roadmap" | "structure" | "dependencies";

interface CurriculumRoadmapWorkspaceProps {
  sources: CurriculumSource[];
  selectedSourceId: string;
  tree: CurriculumTreeData;
  roadmap: CurriculumRoadmapModel;
  graph: ProgressionGraph;
  exportText: string;
  outlineWarning?: string | null;
  progressionDebug?: unknown;
  initialView?: ViewMode;
  initialFocusedSkillId?: string | null;
  regenerateAction?: (
    sourceId: string,
  ) => Promise<{ kind: string; reason?: string; phaseCount?: number; attemptCount?: number }>;
}

interface SkillFilters {
  domainId: string;
  unitRef: string;
  role: string;
  launchSliceOnly: boolean;
  needsSupportOnly: boolean;
  safetyOnly: boolean;
}

function inputClassName() {
  return "h-10 w-full rounded-xl border border-border/70 bg-background/82 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/70";
}

function statusTone(value: CurriculumRoadmapModel["summary"]["progression"]["status"]) {
  switch (value) {
    case "explicit_ready":
      return "success";
    case "stale":
      return "info";
    case "explicit_failed":
    case "fallback_only":
    case "not_attempted":
    default:
      return "warning";
  }
}

function summaryCards(roadmap: CurriculumRoadmapModel) {
  return [
    {
      label: "Pacing",
      value: roadmap.summary.pacing.label ?? "Not set",
      hint: "Session rhythm from source pacing or unit estimates.",
    },
    {
      label: "Phases",
      value: String(roadmap.summary.totalPhases),
      hint: "How the roadmap is chunked for communication.",
    },
    {
      label: "Skills",
      value: String(roadmap.summary.totalSkills),
      hint: "Teachable skills in the normalized curriculum tree.",
    },
    {
      label: "Units",
      value: String(roadmap.summary.totalUnits),
      hint: "Stored unit anchors available for grouping and work context.",
    },
    {
      label: "Lessons",
      value: String(roadmap.summary.totalLessons),
      hint: "Linked lesson work connected to the roadmap.",
    },
    {
      label: "Progression",
      value: roadmap.summary.progression.label,
      hint: roadmap.summary.progression.detail,
    },
    roadmap.summary.launchSlice
      ? {
          label: "Opening slice",
          value: roadmap.summary.launchSlice.label,
          hint: roadmap.summary.launchSlice.scopeSummary,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string; hint: string }>;
}

function dependencyAttemptLabel(attempt: any) {
  if (attempt.accepted) {
    return attempt.repairAttempt?.accepted ? "Accepted after repair" : "Accepted";
  }
  return "Rejected";
}

function AttemptCard({ attempt }: { attempt: any }) {
  return (
    <div className="space-y-2 rounded-2xl border border-border/70 bg-background/82 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Attempt {attempt.attemptNumber}</p>
          <p className="text-xs text-muted-foreground">
            {dependencyAttemptLabel(attempt)}
            {attempt.failureReason ? ` · ${attempt.failureReason}` : ""}
          </p>
        </div>
        <Badge variant={attempt.accepted ? "secondary" : "outline"}>
          {attempt.accepted ? "Accepted" : "Rejected"}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Transport: {attempt.transportStatus}</span>
        <span>Parse: {attempt.parseStatus}</span>
        <span>Schema: {attempt.schemaStatus}</span>
        <span>Semantic: {attempt.semanticStatus}</span>
      </div>
      {attempt.summary ? (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{attempt.summary.phaseCount} phases</span>
          <span>{attempt.summary.edgeCount} edges</span>
          {attempt.summary.missingSkillRefs > 0 ? (
            <span className="text-amber-700 dark:text-amber-300">
              {attempt.summary.missingSkillRefs} missing skills
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CurriculumRoadmapWorkspace({
  sources,
  selectedSourceId,
  tree,
  roadmap,
  graph,
  exportText,
  outlineWarning = null,
  progressionDebug,
  initialView = "roadmap",
  initialFocusedSkillId = null,
  regenerateAction,
}: CurriculumRoadmapWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = React.useState<ViewMode>(initialView);
  const [filters, setFilters] = React.useState<SkillFilters>({
    domainId: "all",
    unitRef: "all",
    role: "all",
    launchSliceOnly: false,
    needsSupportOnly: false,
    safetyOnly: false,
  });
  const [selectedSkillId, setSelectedSkillId] = React.useState<string | null>(initialFocusedSkillId);
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);
  const [attemptsOpen, setAttemptsOpen] = React.useState(false);
  const [outputOpen, setOutputOpen] = React.useState(false);
  const [regenerateResult, setRegenerateResult] = React.useState<{
    kind: string;
    reason?: string;
    phaseCount?: number;
    attemptCount?: number;
  } | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setView(initialView);
  }, [initialView, selectedSourceId]);

  React.useEffect(() => {
    setSelectedSkillId(initialFocusedSkillId);
  }, [initialFocusedSkillId, selectedSourceId]);

  React.useEffect(() => {
    setFilters({
      domainId: "all",
      unitRef: "all",
      role: "all",
      launchSliceOnly: false,
      needsSupportOnly: false,
      safetyOnly: false,
    });
    setRegenerateResult(null);
    setDiagnosticsOpen(false);
    setAttemptsOpen(false);
    setOutputOpen(false);
  }, [selectedSourceId]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("sourceId", selectedSourceId);
    params.set("view", view);
    window.history.replaceState({}, "", `${pathname}?${params.toString()}`);
  }, [pathname, selectedSourceId, view]);

  const filteredSkills = roadmap.skills.filter((skill) => {
    if (filters.domainId !== "all" && skill.domainId !== filters.domainId) return false;
    if (filters.unitRef !== "all" && skill.unitRef !== filters.unitRef) return false;
    if (filters.role !== "all" && skill.instructionalRole !== filters.role) return false;
    if (filters.launchSliceOnly && !skill.launchSlice.included) return false;
    if (filters.needsSupportOnly && !skill.requiresAdultSupport) return false;
    if (filters.safetyOnly && !skill.safetyCritical) return false;
    return true;
  });

  const visibleSkillIds = new Set(filteredSkills.map((skill) => skill.id));
  const selectedSkill = selectedSkillId ? roadmap.skillById[selectedSkillId] ?? null : null;

  React.useEffect(() => {
    if (!selectedSkillId) return;
    if (visibleSkillIds.has(selectedSkillId)) return;
    setSelectedSkillId(null);
  }, [selectedSkillId, visibleSkillIds]);

  function updateFilter<K extends keyof SkillFilters>(key: K, value: SkillFilters[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function jumpToRoadmap(skillId: string) {
    setSelectedSkillId(skillId);
    setView("roadmap");
  }

  function handleRegenerate() {
    if (!regenerateAction) return;

    setRegenerateResult(null);
    startTransition(async () => {
      const result = await regenerateAction(selectedSourceId);
      setRegenerateResult(result);
      if (result.kind === "success") {
        router.refresh();
      }
    });
  }

  const progressionTone = statusTone(roadmap.summary.progression.status);

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Curriculum source
          </p>
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => {
              const selected = source.id === selectedSourceId;
              const href = `/curriculum/graph?sourceId=${source.id}&view=${view}`;

              return (
                <Link
                  key={source.id}
                  href={href}
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
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards(roadmap).map((card) => (
            <Card key={card.label} className="rounded-[1.35rem] border-border/70 bg-card/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {card.label}
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">{card.value}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.hint}</p>
            </Card>
          ))}
        </div>

        {outlineWarning ? (
          <Card className="rounded-[1.35rem] border-amber-400/40 bg-amber-50/60 px-4 py-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Unit outline warning</p>
            <p className="mt-2 text-sm leading-6">
              {outlineWarning} The roadmap still loads using phase and domain structure, but unit grouping and linked lesson context may be incomplete until the source data is cleaned up.
            </p>
          </Card>
        ) : null}

        <Card className="rounded-[1.5rem] border-border/70 bg-card/72 px-5 py-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  View mode
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Lead with roadmap, browse the source structure second, and inspect dependencies only when needed.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["roadmap", "structure", "dependencies"] as ViewMode[]).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={view === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setView(mode)}
                  >
                    {mode === "roadmap" ? "Roadmap" : mode === "structure" ? "Structure" : "Dependencies"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Domain</span>
                <select
                  value={filters.domainId}
                  onChange={(event) => updateFilter("domainId", event.target.value)}
                  className={inputClassName()}
                >
                  <option value="all">All domains</option>
                  {roadmap.filters.domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.title} ({domain.count})
                    </option>
                  ))}
                </select>
              </label>

              {view !== "dependencies" ? (
                <>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Unit</span>
                  <select
                    value={filters.unitRef}
                    onChange={(event) => updateFilter("unitRef", event.target.value)}
                    className={inputClassName()}
                  >
                    <option value="all">All units</option>
                    {roadmap.filters.units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.title} ({unit.count})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Role</span>
                  <select
                    value={filters.role}
                    onChange={(event) => updateFilter("role", event.target.value)}
                    className={inputClassName()}
                  >
                    <option value="all">All roles</option>
                    {roadmap.filters.roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title} ({role.count})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2 lg:col-span-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={filters.launchSliceOnly ? "default" : "outline"}
                    onClick={() => updateFilter("launchSliceOnly", !filters.launchSliceOnly)}
                  >
                    Opening slice only
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filters.needsSupportOnly ? "default" : "outline"}
                    onClick={() => updateFilter("needsSupportOnly", !filters.needsSupportOnly)}
                  >
                    Needs support
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filters.safetyOnly ? "default" : "outline"}
                    onClick={() => updateFilter("safetyOnly", !filters.safetyOnly)}
                  >
                    Safety-critical only
                  </Button>
                  <div className="ml-auto flex items-center rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground">
                    Showing {filteredSkills.length} of {roadmap.skills.length} skills
                  </div>
                </div>
                </>
              ) : (
                <div className="lg:col-span-2 rounded-2xl border border-border/70 bg-background/78 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Dependency scope
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Use domain scoping here only when you want a tighter local graph. Skill and phase selection stay inside the inspector below.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {view === "roadmap" ? (
          <CurriculumRoadmapView
            roadmap={roadmap}
            visibleSkillIds={visibleSkillIds}
            highlightedSkillId={selectedSkillId}
            onSelectSkill={setSelectedSkillId}
          />
        ) : null}

        {view === "structure" ? (
          <Card className="rounded-[1.5rem] border-border/70 bg-card/72 p-5">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Source structure</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Browse the normalized hierarchy without confusing it for the teaching sequence. Phase chips and
                  roadmap jump actions keep the hierarchy tied back to the roadmap.
                </p>
              </div>
              <CurriculumTree
                tree={tree}
                skillById={roadmap.skillById}
                visibleSkillIds={visibleSkillIds}
                selectedSkillId={selectedSkillId}
                onSelectSkill={setSelectedSkillId}
                onJumpToRoadmap={jumpToRoadmap}
              />
            </div>
          </Card>
        ) : null}

        {view === "dependencies" ? (
          <CurriculumProgressionGraph
            graph={graph}
            roadmap={roadmap}
            selectedDomainId={filters.domainId}
            selectedSkillId={selectedSkillId}
            onSelectSkill={setSelectedSkillId}
          />
        ) : null}

        <Card className="rounded-[1.5rem] border-border/70 bg-card/72">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Diagnostics</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Regeneration, prompt preview, raw output, exports, and attempt diagnostics stay available here
                without competing with the roadmap itself.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setDiagnosticsOpen((open) => !open)}>
              {diagnosticsOpen ? "Hide diagnostics" : "Show diagnostics"}
              {diagnosticsOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </div>

          {diagnosticsOpen ? (
            <div className="space-y-4 border-t border-border/60 px-5 py-5">
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm",
                  progressionTone === "success"
                    ? "border-emerald-400/40 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : progressionTone === "info"
                      ? "border-blue-400/40 bg-blue-50/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                      : "border-amber-400/40 bg-amber-50/60 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {progressionTone === "success" ? (
                        <CheckCircle2 className="size-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="size-4 shrink-0" />
                      )}
                      <span className="font-semibold">{roadmap.summary.progression.label}</span>
                    </div>
                    <p className="text-xs leading-5 opacity-85">{roadmap.summary.progression.detail}</p>
                    <p className="text-xs opacity-70">
                      {roadmap.diagnostics.phaseCount} phases · {graph.edges.length} edges · {graph.nodes.length} skills
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ProgressionPromptPreview sourceId={selectedSourceId} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAttemptsOpen((open) => !open)}
                    >
                      {attemptsOpen
                        ? "Hide attempts"
                        : `View attempts${roadmap.diagnostics.rawAttemptSummaries?.length ? ` (${roadmap.diagnostics.rawAttemptSummaries.length})` : ""}`}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setOutputOpen((open) => !open)}
                    >
                      {outputOpen ? "Hide output" : "View output"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={!regenerateAction || isPending}
                    >
                      <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
                      {isPending ? "Regenerating…" : "Regenerate"}
                    </Button>
                  </div>
                </div>
              </div>

              {regenerateResult ? (
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm",
                    regenerateResult.kind === "success"
                      ? "border-emerald-400/40 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-red-400/40 bg-red-50/60 text-red-800 dark:bg-red-950/30 dark:text-red-300",
                  )}
                >
                  {regenerateResult.kind === "success"
                    ? `Progression regenerated and the page was refreshed. ${regenerateResult.phaseCount ?? 0} phases were accepted.`
                    : `Regeneration failed: ${regenerateResult.reason ?? "Unknown error."}`}
                </div>
              ) : null}

              {attemptsOpen ? (
                <div className="space-y-3">
                  {(roadmap.diagnostics.rawAttemptSummaries ?? []).length > 0 ? (
                    (roadmap.diagnostics.rawAttemptSummaries ?? []).map((attempt, index) => (
                      <AttemptCard key={attempt.attemptNumber ?? index} attempt={attempt} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/80 px-4 py-4 text-sm text-muted-foreground">
                      No attempt diagnostics are stored for this source yet.
                    </div>
                  )}
                </div>
              ) : null}

              {outputOpen ? (
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="text-sm font-semibold text-foreground">Raw progression output</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    This is the stored phases, prerequisites, and diagnostics payload.
                  </p>
                  <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
                    {JSON.stringify(progressionDebug, null, 2)}
                  </pre>
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <CurriculumExportCard title="Export" text={exportText} />
                <CurriculumRefinementWidget sourceId={selectedSourceId} sourceTitle={tree.source.title} />
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <CurriculumSkillDrawer open={selectedSkill != null} skill={selectedSkill} onClose={() => setSelectedSkillId(null)} />
    </>
  );
}
