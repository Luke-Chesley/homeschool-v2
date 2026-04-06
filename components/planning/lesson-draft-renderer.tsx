"use client";

import type {
  LessonAdaptation,
  LessonBlock,
  LessonBlockType,
  StructuredLessonDraft,
} from "@/lib/lesson-draft/types";
import { Card } from "@/components/ui/card";
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
  return (
    <div className="space-y-2 border-b border-border/70 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{draft.total_minutes} min</Badge>
        {draft.lesson_shape ? (
          <Badge variant="outline">{draft.lesson_shape.replace("_", " ")}</Badge>
        ) : null}
        <Badge variant="outline">{draft.blocks.length} blocks</Badge>
      </div>
      <h2 className="font-serif text-2xl leading-tight">{draft.title}</h2>
      <p className="text-sm text-muted-foreground">{draft.lesson_focus}</p>
    </div>
  );
}

function ObjectivesAndCriteria({ draft }: { draft: StructuredLessonDraft }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Objectives
        </p>
        <ul className="space-y-1">
          {draft.primary_objectives.map((obj, i) => (
            <li key={i} className="text-sm leading-5">
              {obj}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Done when
        </p>
        <ul className="space-y-1">
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

function BlockCard({ block, index }: { block: LessonBlock; index: number }) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/70 border-l-2 bg-background p-4",
        getBlockAccent(block.type),
        block.optional && "opacity-75",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Badge variant="outline" className="text-xs">
            {BLOCK_TYPE_LABELS[block.type]}
          </Badge>
          <span className="text-xs text-muted-foreground">{block.minutes} min</span>
          {block.optional ? (
            <span className="text-xs text-muted-foreground italic">optional</span>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-sm font-medium leading-5">{block.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{block.purpose}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-foreground">You</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {block.teacher_action}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">Learner</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {block.learner_action}
          </p>
        </div>
      </div>

      {block.check_for ? (
        <div className="mt-3 rounded border border-border/50 bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium text-foreground">Check for</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{block.check_for}</p>
        </div>
      ) : null}

      {block.materials_needed && block.materials_needed.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {block.materials_needed.map((m, i) => (
            <span
              key={i}
              className="rounded bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              {m}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MaterialsList({ materials }: { materials: string[] }) {
  if (materials.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Materials
      </p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {materials.map((m, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeacherNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Notes
      </p>
      <ul className="space-y-1">
        {notes.map((note, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            {note}
          </li>
        ))}
      </ul>
    </div>
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
    <div key={index} className="rounded border border-border/60 bg-muted/20 p-3">
      <p className="text-xs font-medium text-foreground">{triggerLabel}</p>
      <p className="mt-1 text-xs text-muted-foreground">{adaptation.action}</p>
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
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Additional
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {modules.map((mod, i) => (
          <div key={i} className="rounded border border-border/50 bg-muted/20 p-3">
            <p className="text-xs font-medium text-foreground">{mod.label}</p>
            {Array.isArray(mod.content) ? (
              <ul className="mt-1 space-y-0.5">
                {mod.content.map((item, j) => (
                  <li key={j} className="text-xs text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{mod.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export function LessonDraftRenderer({
  draft,
  mode = "full",
  className,
}: LessonDraftRendererProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <LessonHeader draft={draft} />

      <ObjectivesAndCriteria draft={draft} />

      {/* Lesson blocks */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Lesson flow
        </p>
        <div className="space-y-2">
          {draft.blocks.map((block, i) => (
            <BlockCard key={i} block={block} index={i} />
          ))}
        </div>
      </div>

      {/* Materials */}
      <MaterialsList materials={draft.materials} />

      {/* Adaptations */}
      {draft.adaptations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Adaptations
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {draft.adaptations.map((a, i) => (
              <AdaptationCard key={i} adaptation={a} index={i} />
            ))}
          </div>
        </div>
      ) : null}

      {/* Teacher notes */}
      <TeacherNotes notes={draft.teacher_notes} />

      {/* Optional modules (only when present) */}
      {mode === "full" ? <OptionalModules draft={draft} /> : null}
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
