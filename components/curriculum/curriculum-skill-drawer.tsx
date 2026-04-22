"use client";

import * as React from "react";
import { ArrowUpRight, BookOpenText, ShieldAlert, UserRound, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoadmapSkill } from "@/lib/curriculum/roadmap-model";
import { cn } from "@/lib/utils";

interface CurriculumSkillDrawerProps {
  open: boolean;
  skill: RoadmapSkill | null;
  onClose: () => void;
}

function roleLabel(value: RoadmapSkill["instructionalRole"]) {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

function dependencyHeading(label: string, count: number) {
  return count === 0 ? `${label} · none` : `${label} · ${count}`;
}

export function CurriculumSkillDrawer({ open, skill, onClose }: CurriculumSkillDrawerProps) {
  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-foreground/25" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="curriculum-skill-drawer-title"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-[32rem] flex-col border-l border-border/70 bg-background shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Skill detail
            </p>
            <h2 id="curriculum-skill-drawer-title" className="font-serif text-2xl leading-tight text-foreground">
              {skill?.title ?? "Skill"}
            </h2>
            {skill?.breadcrumb ? (
              <p className="text-sm leading-6 text-muted-foreground">{skill.breadcrumb}</p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close skill detail" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {!skill ? null : (
            <div className="space-y-6">
              <section className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {skill.phaseTitle ? <Badge variant="secondary">{skill.phaseTitle}</Badge> : null}
                  {skill.unitTitle ? <Badge variant="outline">{skill.unitTitle}</Badge> : null}
                  {skill.instructionalRole ? <Badge variant="outline">{roleLabel(skill.instructionalRole)}</Badge> : null}
                  {skill.launchSlice.included ? <Badge variant="outline">Opening slice</Badge> : null}
                </div>
                {skill.description ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{skill.description}</p>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    This skill is part of the curriculum sequence and can be inspected through its phase,
                    unit anchor, dependencies, and linked lessons.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {skill.requiresAdultSupport ? (
                    <Badge variant="outline" className="gap-1">
                      <UserRound className="size-3.5" />
                      Adult support
                    </Badge>
                  ) : null}
                  {skill.safetyCritical ? (
                    <Badge variant="outline" className="gap-1">
                      <ShieldAlert className="size-3.5" />
                      Safety-critical
                    </Badge>
                  ) : null}
                  {skill.isAuthenticApplication ? (
                    <Badge variant="outline" className="gap-1">
                      <ArrowUpRight className="size-3.5" />
                      Authentic application
                    </Badge>
                  ) : null}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Phase</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{skill.phaseTitle ?? "Not assigned"}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {skill.phaseTitle
                      ? "Use the roadmap view to see where this work sits in the teaching journey."
                      : "This skill is not assigned to an explicit phase yet."}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Unit anchor</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{skill.unitTitle ?? "No unit anchor"}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {skill.unitTitle
                      ? "This skill maps cleanly to a curriculum unit and can be read in that work context."
                      : "This skill currently reads best as domain or strand work rather than unit-bound work."}
                  </p>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Dependencies
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    The roadmap leads with sequence, but the exact dependency semantics still stay visible here.
                  </p>
                </div>
                <div className="grid gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {dependencyHeading("Hard prerequisites", skill.dependencySummary.hardPrerequisite.count)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {skill.dependencySummary.hardPrerequisite.count > 0
                        ? skill.dependencySummary.hardPrerequisite.titles.join(", ")
                        : "No hard prerequisite skills are recorded here."}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {dependencyHeading("Helpful before", skill.dependencySummary.recommendedBefore.count)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {skill.dependencySummary.recommendedBefore.count > 0
                        ? skill.dependencySummary.recommendedBefore.titles.join(", ")
                        : "No recommended-before skills are recorded here."}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {dependencyHeading("Revisit links", skill.dependencySummary.revisitAfter.count)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {skill.dependencySummary.revisitAfter.count > 0
                        ? skill.dependencySummary.revisitAfter.titles.join(", ")
                        : "No revisit links are recorded here."}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {dependencyHeading("Co-practice links", skill.dependencySummary.coPractice.count)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {skill.dependencySummary.coPractice.count > 0
                        ? skill.dependencySummary.coPractice.titles.join(", ")
                        : "No co-practice links are recorded here."}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {dependencyHeading("Unlocks", skill.dependencySummary.unlocks.count)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {skill.dependencySummary.unlocks.count > 0
                        ? skill.dependencySummary.unlocks.titles.join(", ")
                        : "No downstream skills are connected from this node."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Linked work
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Lessons and source anchors give the skill real classroom work underneath the roadmap.
                  </p>
                </div>
                {skill.linkedLessons.length > 0 ? (
                  <div className="space-y-2">
                    {skill.linkedLessons.map((lesson) => (
                      <div key={lesson.id} className="rounded-xl border border-border/70 bg-background/80 px-3 py-2.5">
                        <p className="text-sm font-semibold text-foreground">{lesson.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          {lesson.unitTitle}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 px-3 py-3 text-sm leading-6 text-muted-foreground">
                    No linked lessons were stored for this skill.
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <div className="flex items-start gap-3">
                  <BookOpenText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Opening slice status</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {skill.launchSlice.included
                        ? skill.launchSlice.viaSkill
                          ? "This skill is explicitly part of the opening slice."
                          : "This skill is included through an opening unit."
                        : "This skill is outside the opening slice and sits later in the full curriculum."}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
