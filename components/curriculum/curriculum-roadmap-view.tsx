"use client";

import { ArrowUpRight, ShieldAlert, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CurriculumRoadmapModel, RoadmapPhase, RoadmapSkill } from "@/lib/curriculum/roadmap-model";
import { cn } from "@/lib/utils";

interface CurriculumRoadmapViewProps {
  roadmap: CurriculumRoadmapModel;
  visibleSkillIds: Set<string>;
  highlightedSkillId?: string | null;
  onSelectSkill: (skillId: string) => void;
}

function roleLabel(value: RoadmapSkill["instructionalRole"]) {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

function dependencyPhrases(skill: RoadmapSkill) {
  const phrases: string[] = [];

  if (skill.dependencySummary.hardPrerequisite.count > 0) {
    phrases.push(`requires ${skill.dependencySummary.hardPrerequisite.count}`);
  }
  if (skill.dependencySummary.recommendedBefore.count > 0) {
    phrases.push(`helpful after ${skill.dependencySummary.recommendedBefore.count}`);
  }
  if (skill.dependencySummary.revisitAfter.count > 0) {
    phrases.push(
      skill.dependencySummary.revisitAfter.count === 1
        ? "revisit link"
        : `revisit links ${skill.dependencySummary.revisitAfter.count}`,
    );
  }
  if (skill.dependencySummary.coPractice.count > 0) {
    phrases.push(`pair with ${skill.dependencySummary.coPractice.count}`);
  }
  if (skill.dependencySummary.unlocks.count > 0) {
    phrases.push(`unlocks ${skill.dependencySummary.unlocks.count}`);
  }

  return phrases;
}

function dependencySummaryLine(skill: RoadmapSkill) {
  const phrases = dependencyPhrases(skill);
  return phrases.length > 0 ? phrases.join(" · ") : "No explicit dependency links recorded for this skill.";
}

function workStackLabel(phase: RoadmapPhase) {
  const count = phase.groups.length;
  const noun = phase.groupingStrategy === "unit" ? "unit stack" : "domain stack";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function filterPhases(roadmap: CurriculumRoadmapModel, visibleSkillIds: Set<string>) {
  return roadmap.phases
    .map((phase) => {
      const filteredGroups = phase.groups
        .map((group) => ({
          ...group,
          skillIds: group.skillIds.filter((skillId) => visibleSkillIds.has(skillId)),
        }))
        .filter((group) => group.skillIds.length > 0);

      const visiblePhaseSkillIds = filteredGroups.flatMap((group) => group.skillIds);
      if (visiblePhaseSkillIds.length === 0) {
        return null;
      }

      return {
        ...phase,
        groups: filteredGroups,
        skillCount: visiblePhaseSkillIds.length,
        domainCount: new Set(visiblePhaseSkillIds.map((skillId) => roadmap.skillById[skillId]?.domainId)).size,
        unitCount: new Set(visiblePhaseSkillIds.map((skillId) => roadmap.skillById[skillId]?.unitRef).filter(Boolean)).size,
        lessonCount: new Set(
          visiblePhaseSkillIds.flatMap((skillId) => roadmap.skillById[skillId]?.linkedLessons.map((lesson) => lesson.id) ?? []),
        ).size,
      } satisfies RoadmapPhase;
    })
    .filter((phase): phase is RoadmapPhase => Boolean(phase));
}

function SkillRow({
  skill,
  highlighted,
  onSelect,
}: {
  skill: RoadmapSkill;
  highlighted: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-3 rounded-[1.35rem] border border-border/70 bg-background/88 px-4 py-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-[var(--motion-base)] ease-[var(--ease-standard)]",
        "hover:-translate-y-px hover:border-border hover:bg-background hover:shadow-[var(--shadow-soft)]",
        highlighted && "border-primary/40 bg-primary/6 shadow-[var(--shadow-active)]",
      )}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0 space-y-2">
          <div className="space-y-1.5">
            <p className="text-[0.97rem] font-semibold leading-7 text-foreground">{skill.title}</p>
            <p className="text-xs leading-5 text-muted-foreground">{skill.breadcrumb}</p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{dependencySummaryLine(skill)}</p>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          {skill.instructionalRole ? <Badge variant="secondary">{roleLabel(skill.instructionalRole)}</Badge> : null}
          {skill.unitTitle ? <Badge variant="outline">{skill.unitTitle}</Badge> : null}
          {skill.launchSlice.included ? <Badge variant="outline">Opening slice</Badge> : null}
          {skill.lessonCount > 0 ? (
            <Badge variant="outline">
              {skill.lessonCount} lesson{skill.lessonCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {skill.requiresAdultSupport ? (
          <Badge variant="outline" className="gap-1">
            <UserRound className="size-3.5" />
            Adult support
          </Badge>
        ) : null}
        {skill.safetyCritical ? (
          <Badge variant="outline" className="gap-1">
            <ShieldAlert className="size-3.5" />
            Safety
          </Badge>
        ) : null}
        {skill.isAuthenticApplication ? (
          <Badge variant="outline" className="gap-1">
            <ArrowUpRight className="size-3.5" />
            Application
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

function GroupCard({
  group,
  phase,
  roadmap,
  highlightedSkillId,
  onSelectSkill,
}: {
  group: RoadmapPhase["groups"][number];
  phase: RoadmapPhase;
  roadmap: CurriculumRoadmapModel;
  highlightedSkillId?: string | null;
  onSelectSkill: (skillId: string) => void;
}) {
  return (
    <Card className="overflow-hidden rounded-[1.55rem] border-border/70 bg-background/90">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="space-y-4 border-b border-border/60 bg-muted/18 px-5 py-5 xl:border-b-0 xl:border-r">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{group.type === "unit" ? "Unit" : "Domain"}</Badge>
              {group.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[11px] text-muted-foreground">
                  {tag}
                </Badge>
              ))}
            </div>
            <p className="text-lg font-semibold text-foreground">{group.title}</p>
            <p className="text-sm leading-6 text-muted-foreground">{group.subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {group.skillIds.length} skill{group.skillIds.length === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">
              {group.lessonCount} lesson{group.lessonCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">{phase.groupingStrategy === "unit" ? "Anchored in sequence" : "Domain-aligned"}</Badge>
          </div>
        </div>

        <div className="space-y-3 px-5 py-5">
          {group.skillIds.map((skillId) => {
            const skill = roadmap.skillById[skillId];
            if (!skill) return null;
            return (
              <SkillRow
                key={skill.id}
                skill={skill}
                highlighted={highlightedSkillId === skill.id}
                onSelect={() => onSelectSkill(skill.id)}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export function CurriculumRoadmapView({
  roadmap,
  visibleSkillIds,
  highlightedSkillId,
  onSelectSkill,
}: CurriculumRoadmapViewProps) {
  const phases = filterPhases(roadmap, visibleSkillIds);

  if (phases.length === 0) {
    return (
      <Card className="rounded-[1.5rem] border-dashed border-border/80 p-6">
        <p className="text-sm font-semibold text-foreground">No roadmap matches the current filters.</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Clear one or more filters to bring the teaching sequence back into view.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {phases.map((phase) => (
        <section key={phase.id} className="overflow-hidden rounded-[1.9rem] border border-border/70 bg-card/72">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(21rem,24rem)]">
            <div className="space-y-5 px-5 py-6 sm:px-6 sm:py-7 xl:border-r xl:border-border/60">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={phase.isFallback ? "outline" : "secondary"}>
                  {phase.isFallback ? "Fallback" : `Phase ${phase.position + 1}`}
                </Badge>
                <Badge variant="outline">{phase.groupingStrategy === "unit" ? "Unit-led" : "Domain-led"}</Badge>
              </div>

              <div className="space-y-3">
                <h2 className="font-serif text-[1.9rem] leading-tight tracking-[-0.03em] text-foreground">
                  {phase.title}
                </h2>
                {phase.description ? (
                  <p className="max-w-2xl text-[0.98rem] leading-8 text-muted-foreground">{phase.description}</p>
                ) : null}
              </div>

              <div className="rounded-[1.4rem] border border-border/60 bg-background/76 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Phase framing</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{phase.natureLabel}</p>
              </div>
            </div>

            <div className="grid gap-3 bg-muted/18 px-5 py-6 sm:grid-cols-3 sm:px-6 xl:grid-cols-1 xl:px-5">
              <div className="rounded-2xl border border-border/70 bg-background/84 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Coverage</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {phase.skillCount} skills · {phase.domainCount} domains
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {phase.unitCount} units · {phase.lessonCount} lessons
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/84 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Work stacks</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{workStackLabel(phase)}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {phase.groupingStrategy === "unit"
                    ? "Grouped around the clearest unit anchors in this phase."
                    : "Grouped by domain when unit anchors are weaker or fragmented."}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/84 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pacing hint</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{phase.pacingHint ?? "Use the skill density as the cue."}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  The roadmap is sequence-first, then work structure, then dependencies.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 px-5 py-5 sm:px-6 sm:py-6">
            <div className="space-y-4">
            {phase.groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                phase={phase}
                roadmap={roadmap}
                highlightedSkillId={highlightedSkillId}
                onSelectSkill={onSelectSkill}
              />
            ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
