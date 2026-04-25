"use client";

import type { ReactNode } from "react";

import { LessonBlockHelp } from "@/components/planning/lesson-block-help";
import type {
  LessonAdaptation,
  LessonBlock,
  LessonBlockType,
  LessonVisualAid,
  StructuredLessonDraft,
} from "@/lib/lesson-draft/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Presentation config (controls layout, not content)
// ---------------------------------------------------------------------------

export type LessonDraftViewMode = "full" | "compact";

interface LessonDraftRendererProps {
  draft: StructuredLessonDraft;
  mode?: LessonDraftViewMode;
  className?: string;
  renderBlockFooter?: (block: LessonBlock, index: number) => ReactNode;
}

// ---------------------------------------------------------------------------
// Block type display labels
// ---------------------------------------------------------------------------

const BLOCK_TYPE_LABELS: Record<LessonBlockType, string> = {
  opener: "Opener",
  retrieval: "Retrieval",
  warm_up: "Warm-up",
  model: "Model",
  guided_practice: "Guided practice",
  independent_practice: "Independent practice",
  discussion: "Discussion",
  check_for_understanding: "Check",
  reflection: "Reflection",
  wrap_up: "Wrap-up",
  transition: "Transition",
  movement_break: "Movement break",
  project_work: "Project work",
  read_aloud: "Read-aloud",
  demonstration: "Demonstration",
};

// Block type visual grouping: instructional, check/close, movement, transition
function getBlockAccent(type: LessonBlockType): string {
  const instructional: LessonBlockType[] = [
    "model",
    "guided_practice",
    "independent_practice",
    "demonstration",
    "read_aloud",
    "project_work",
  ];
  const check: LessonBlockType[] = [
    "check_for_understanding",
    "reflection",
  ];
  const movement: LessonBlockType[] = ["movement_break", "transition"];

  if (instructional.includes(type)) return "border-l-primary/40";
  if (check.includes(type)) return "border-l-green-500/40";
  if (movement.includes(type)) return "border-l-muted-foreground/30";
  return "border-l-border";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LessonHeader({ draft }: { draft: StructuredLessonDraft }) {
  const visualAidCount = draft.visual_aids?.length ?? 0;
  return (
    <div className="space-y-3 border-b border-border/70 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{draft.total_minutes} min</Badge>
        {draft.lesson_shape ? (
          <Badge variant="outline">{draft.lesson_shape.replace("_", " ")}</Badge>
        ) : null}
        <Badge variant="outline">{draft.blocks.length} blocks</Badge>
        {visualAidCount > 0 ? (
          <Badge variant="outline">{visualAidCount} visuals</Badge>
        ) : null}
      </div>
      <h2 className="font-serif text-[1.75rem] leading-tight">{draft.title}</h2>
      <p className="max-w-3xl text-base leading-6 text-muted-foreground">{draft.lesson_focus}</p>
    </div>
  );
}

function ObjectivesAndCriteria({ draft }: { draft: StructuredLessonDraft }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Objectives
        </p>
        <ul className="mt-2 space-y-1.5">
          {draft.primary_objectives.map((obj, i) => (
            <li key={i} className="text-sm leading-5">
              {obj}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Done when
        </p>
        <ul className="mt-2 space-y-1.5">
          {draft.success_criteria.map((sc, i) => (
            <li key={i} className="text-sm leading-5 text-muted-foreground">
              {sc}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BlockCard({
  block,
  index,
  footer,
  showInlineHelp,
  lessonTitle,
  lessonFocus,
  visualAids,
}: {
  block: LessonBlock;
  index: number;
  footer?: ReactNode;
  showInlineHelp: boolean;
  lessonTitle: string;
  lessonFocus: string;
  visualAids: LessonVisualAid[];
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 border-l-2 bg-background px-4 py-3",
        getBlockAccent(block.type),
        block.optional && "opacity-75",
      )}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Badge variant="outline" className="text-[11px]">
            {BLOCK_TYPE_LABELS[block.type]}
          </Badge>
          <span className="text-xs text-muted-foreground">{block.minutes} min</span>
          {block.optional ? (
            <span className="text-xs text-muted-foreground italic">optional</span>
          ) : null}
        </div>

        <div className="space-y-1">
          <p className="text-base font-medium leading-5 text-foreground">{block.title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{block.purpose}</p>
        </div>
      </div>

      {visualAids.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {visualAids.map((visualAid) => (
            <figure
              key={visualAid.id}
              className="overflow-hidden rounded-lg border border-border/60 bg-muted/10"
            >
              <img
                src={visualAid.url}
                alt={visualAid.alt}
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
              />
              <figcaption className="space-y-1 border-t border-border/50 p-3">
                <p className="text-sm font-medium leading-5 text-foreground">{visualAid.title}</p>
                {visualAid.caption ? (
                  <p className="text-xs leading-5 text-muted-foreground">{visualAid.caption}</p>
                ) : null}
                {visualAid.usage_note ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Use: {visualAid.usage_note}
                  </p>
                ) : null}
                {visualAid.source_name ? (
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {visualAid.source_name}
                  </p>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/50 bg-muted/12 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            You do
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">{block.teacher_action}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/12 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Learner does
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">{block.learner_action}</p>
        </div>
      </div>

      {block.check_for ? (
        <div className="mt-3 rounded-lg border border-border/50 bg-background/72 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Look for
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">{block.check_for}</p>
        </div>
      ) : null}

      {showInlineHelp ? (
        <LessonBlockHelp
          block={block}
          blockIndex={index}
          lessonTitle={lessonTitle}
          lessonFocus={lessonFocus}
        />
      ) : null}

      {footer ? <div className="mt-3 flex justify-end">{footer}</div> : null}
    </div>
  );
}

function CollapsibleSection({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rounded-lg border border-border/60 bg-muted/12" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </summary>
      <div className="border-t border-border/50 px-3 py-3">{children}</div>
    </details>
  );
}

function isVisibleMaterial(material: string) {
  const value = material.trim();

  if (!value) return false;
  if (value.includes("domain:")) return false;
  if (value.includes("strand:")) return false;
  if (value.includes("goal_group:")) return false;
  if (value.includes("skill:")) return false;
  if (value.split("/").length >= 4) return false;

  return true;
}

function MaterialsList({ materials }: { materials: string[] }) {
  const visibleMaterials = materials.filter(isVisibleMaterial);

  if (visibleMaterials.length === 0) return null;

  return (
    <CollapsibleSection label={`Materials · ${visibleMaterials.length}`}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {visibleMaterials.map((m, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-6">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            {m}
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
}

function TeacherNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <CollapsibleSection label="Notes">
      <ul className="space-y-2">
        {notes.map((note, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            {note}
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
}

function AdaptationCard({ adaptation, index }: { adaptation: LessonAdaptation; index: number }) {
  const triggerLabel =
    adaptation.trigger === "if_struggles"
      ? "If struggles"
      : adaptation.trigger === "if_finishes_early"
        ? "If early"
        : adaptation.trigger === "if_attention_drops"
          ? "If attention drops"
          : adaptation.trigger === "if_materials_missing"
            ? "If missing materials"
            : adaptation.trigger;

  return (
    <div key={index} className="rounded-lg border border-border/50 bg-background/70 p-3">
      <p className="text-xs font-medium text-foreground">{triggerLabel}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{adaptation.action}</p>
    </div>
  );
}

function OptionalModules({ draft }: { draft: StructuredLessonDraft }) {
  const modules: Array<{ label: string; content: string | string[] }> = [];

  if (draft.prep && draft.prep.length > 0) {
    modules.push({ label: "Prep", content: draft.prep });
  }
  if (draft.assessment_artifact) {
    modules.push({ label: "Collect", content: draft.assessment_artifact });
  }
  if (draft.extension) {
    modules.push({ label: "Extension", content: draft.extension });
  }
  if (draft.follow_through) {
    modules.push({ label: "Next time", content: draft.follow_through });
  }
  if (draft.accommodations && draft.accommodations.length > 0) {
    modules.push({ label: "Accommodations", content: draft.accommodations });
  }
  if (draft.co_teacher_notes && draft.co_teacher_notes.length > 0) {
    modules.push({ label: "Co-teacher", content: draft.co_teacher_notes });
  }

  if (modules.length === 0) return null;

  return (
    <CollapsibleSection label="More guidance">
      <div className="grid gap-2 sm:grid-cols-2">
        {modules.map((mod, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-background/70 p-3">
            <p className="text-xs font-medium text-foreground">{mod.label}</p>
            {Array.isArray(mod.content) ? (
              <ul className="mt-2 space-y-1">
                {mod.content.map((item, j) => (
                  <li key={j} className="text-sm leading-6 text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{mod.content}</p>
            )}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export function LessonDraftRenderer({
  draft,
  mode = "full",
  className,
  renderBlockFooter,
}: LessonDraftRendererProps) {
  const showInlineHelp = mode !== "compact";
  const visualAidById = new Map((draft.visual_aids ?? []).map((visualAid) => [visualAid.id, visualAid]));

  return (
    <div className={cn("space-y-6", className)}>
      <LessonHeader draft={draft} />

      <ObjectivesAndCriteria draft={draft} />

      <MaterialsList materials={draft.materials} />

      {/* Lesson blocks */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Lesson flow
        </p>
        <div className="space-y-2">
          {draft.blocks.map((block, i) => (
            <BlockCard
              key={i}
              block={block}
              index={i}
              footer={renderBlockFooter?.(block, i)}
              showInlineHelp={showInlineHelp}
              lessonTitle={draft.title}
              lessonFocus={draft.lesson_focus}
              visualAids={(block.visual_aid_ids ?? [])
                .map((visualAidId) => visualAidById.get(visualAidId))
                .filter((visualAid): visualAid is LessonVisualAid => Boolean(visualAid))}
            />
          ))}
        </div>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Legacy fallback (renders markdown string for old drafts)
// ---------------------------------------------------------------------------

export function LegacyLessonDraftNotice() {
  return (
    <div className="rounded border border-border/50 bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        This draft was generated in an older format. Regenerate to get the structured view.
      </p>
    </div>
  );
}
