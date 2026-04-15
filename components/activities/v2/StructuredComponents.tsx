"use client";

/**
 * Structured interaction components.
 * checklist, ordered_sequence, matching_pairs, categorization,
 * sort_into_groups, build_steps, drag_arrange
 *
 * These components manage more complex internal state.
 * Evidence is captured as the final submitted state.
 */

import * as React from "react";
import { GripVertical, HelpCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentRendererProps } from "./types";
import type {
  ChecklistComponentSchema,
  OrderedSequenceComponentSchema,
  MatchingPairsComponentSchema,
  CategorizationComponentSchema,
  SortIntoGroupsComponentSchema,
  BuildStepsComponentSchema,
  DragArrangeComponentSchema,
} from "@/lib/activities/components";
import type { z } from "zod";

type ChecklistSpec = z.infer<typeof ChecklistComponentSchema>;
type OrderedSequenceSpec = z.infer<typeof OrderedSequenceComponentSchema>;
type MatchingPairsSpec = z.infer<typeof MatchingPairsComponentSchema>;
type CategorizationSpec = z.infer<typeof CategorizationComponentSchema>;
type SortIntoGroupsSpec = z.infer<typeof SortIntoGroupsComponentSchema>;
type BuildStepsSpec = z.infer<typeof BuildStepsComponentSchema>;
type DragArrangeSpec = z.infer<typeof DragArrangeComponentSchema>;

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export function ChecklistComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<ChecklistSpec>) {
  const checked: string[] = Array.isArray(value) ? (value as string[]) : [];

  function toggle(id: string) {
    const next = checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id];
    onChange(spec.id, next);
  }

  return (
    <div className="flex flex-col gap-3">
      {spec.prompt && <p className="text-sm font-medium">{spec.prompt}</p>}
      <div className="flex flex-col gap-2">
        {spec.items.map((item) => {
          const isChecked = checked.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(item.id)}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                isChecked
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card/60 hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 size-4 shrink-0 rounded border flex items-center justify-center transition-colors",
                  isChecked ? "border-primary bg-primary" : "border-border",
                )}
              >
                {isChecked && <CheckCircle2 className="size-3 text-primary-foreground" />}
              </span>
              <span>
                <span className="font-medium">{item.label}</span>
                {item.description && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ordered sequence (drag to reorder)
// ---------------------------------------------------------------------------

export function OrderedSequenceComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<OrderedSequenceSpec>) {
  // value is an array of item IDs in current order
  const currentOrder: string[] = Array.isArray(value)
    ? (value as string[])
    : spec.items.map((i) => i.id);

  const orderedItems = currentOrder
    .map((id) => spec.items.find((i) => i.id === id))
    .filter(Boolean) as (typeof spec.items)[number][];

  // Simple "click to move up/down" for accessibility (real DnD requires extra deps)
  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...currentOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(spec.id, next);
  }

  function moveDown(idx: number) {
    if (idx === currentOrder.length - 1) return;
    const next = [...currentOrder];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(spec.id, next);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      <div className="flex flex-col gap-2">
        {orderedItems.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card/70 px-4 py-2.5"
          >
            <GripVertical className="size-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm">{item.text}</span>
            {!disabled && (
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === orderedItems.length - 1}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {spec.hint && (
        <p className="text-xs text-muted-foreground italic">{spec.hint}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matching pairs
// ---------------------------------------------------------------------------

export function MatchingPairsComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<MatchingPairsSpec>) {
  // value: Record<leftId, rightId>
  const matches: Record<string, string> = (
    value && typeof value === "object" && !Array.isArray(value)
  ) ? (value as Record<string, string>) : {};

  const [selected, setSelected] = React.useState<{ side: "left" | "right"; id: string } | null>(
    null,
  );

  // Shuffle right side for display (use stable shuffle seeded by spec id)
  const rightItems = React.useMemo(() => {
    return [...spec.pairs].sort((a, b) => a.id.localeCompare(b.id));
  }, [spec.pairs]);

  function handleSelect(side: "left" | "right", id: string) {
    if (disabled) return;

    if (!selected) {
      setSelected({ side, id });
      return;
    }

    // Match if opposite sides selected
    if (selected.side !== side) {
      const leftId = side === "left" ? id : selected.id;
      const rightId = side === "right" ? id : selected.id;
      const next = { ...matches, [leftId]: rightId };
      onChange(spec.id, next);
      setSelected(null);
    } else {
      // Same side — just change selection
      setSelected({ side, id });
    }
  }

  function clearMatch(leftId: string) {
    if (disabled) return;
    const next = { ...matches };
    delete next[leftId];
    onChange(spec.id, next);
    if (selected?.side === "left" && selected.id === leftId) {
      setSelected(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {spec.prompt && <p className="text-sm font-medium">{spec.prompt}</p>}
      <div className="grid grid-cols-2 gap-3">
        {/* Left column */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Prompts
          </p>
          {spec.pairs.map((pair) => {
            const matchedRight = matches[pair.id];
            const isSelected = selected?.side === "left" && selected.id === pair.id;
            return (
              <div
                key={pair.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors",
                  matchedRight
                    ? "border-primary/40 bg-primary/5"
                    : isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSelect("left", pair.id)}
                  disabled={disabled}
                  className={cn(
                    "min-w-0 flex-1 text-left text-sm",
                    !disabled && "hover:text-foreground",
                    matchedRight ? "text-primary" : "text-foreground",
                  )}
                  aria-pressed={isSelected}
                >
                  <span className="block truncate">{pair.left}</span>
                </button>
                {matchedRight ? (
                  <button
                    type="button"
                    onClick={() => clearMatch(pair.id)}
                    disabled={disabled}
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                    aria-label={`Clear match for ${pair.left}`}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Answers
          </p>
          {rightItems.map((pair) => {
            const isMatched = Object.values(matches).includes(pair.id);
            const isSelected = selected?.side === "right" && selected.id === pair.id;
            return (
              <button
                key={pair.id}
                type="button"
                onClick={() => handleSelect("right", pair.id)}
                disabled={isMatched}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  isMatched
                    ? "border-primary/40 bg-primary/5 text-muted-foreground line-through opacity-60"
                    : isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/60 hover:bg-muted/60",
                )}
              >
                {pair.right}
              </button>
            );
          })}
        </div>
      </div>
      {spec.hint && <p className="text-xs text-muted-foreground italic">{spec.hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

export function CategorizationComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<CategorizationSpec>) {
  // value: Record<itemId, categoryId[]>
  const assignments: Record<string, string[]> = (
    value && typeof value === "object" && !Array.isArray(value)
  ) ? (value as Record<string, string[]>) : {};

  function toggle(itemId: string, categoryId: string) {
    if (disabled) return;
    const current = assignments[itemId] ?? [];
    const next = current.includes(categoryId)
      ? current.filter((c) => c !== categoryId)
      : [...current, categoryId];
    onChange(spec.id, { ...assignments, [itemId]: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      <div className="flex flex-col gap-3">
        {spec.items.map((item) => {
          const assigned = assignments[item.id] ?? [];
          return (
            <div key={item.id} className="rounded-lg border border-border bg-card/70 p-3 flex flex-col gap-2">
              <p className="text-sm">{item.text}</p>
              <div className="flex flex-wrap gap-2">
                {spec.categories.map((cat) => {
                  const isSelected = assigned.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(item.id, cat.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card/70 hover:bg-muted",
                      )}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {spec.hint && <p className="text-xs text-muted-foreground italic">{spec.hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort into groups
// ---------------------------------------------------------------------------

export function SortIntoGroupsComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<SortIntoGroupsSpec>) {
  // value: Record<itemId, groupId>
  const assignments: Record<string, string> = (
    value && typeof value === "object" && !Array.isArray(value)
  ) ? (value as Record<string, string>) : {};

  function assign(itemId: string, groupId: string) {
    if (disabled) return;
    onChange(spec.id, { ...assignments, [itemId]: groupId });
  }

  const ungrouped = spec.items.filter((i) => !assignments[i.id]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>

      {/* Ungrouped items */}
      {ungrouped.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ungrouped.map((item) => (
            <span
              key={item.id}
              className="rounded-full border border-dashed border-border px-3 py-1 text-xs bg-muted/50"
            >
              {item.text}
            </span>
          ))}
        </div>
      )}

      {/* Groups */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {spec.groups.map((group) => {
          const groupItems = spec.items.filter((i) => assignments[i.id] === group.id);
          return (
            <div key={group.id} className="rounded-lg border border-border bg-card/60 p-3 flex flex-col gap-2 min-h-[80px]">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {groupItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const next = { ...assignments };
                      delete next[item.id];
                      onChange(spec.id, next);
                    }}
                    className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    {item.text} ✕
                  </button>
                ))}
              </div>
              {!disabled && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {ungrouped.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => assign(item.id, group.id)}
                      className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      + {item.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {spec.hint && <p className="text-xs text-muted-foreground italic">{spec.hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build steps (scaffolded problem-solving)
// ---------------------------------------------------------------------------

export function BuildStepsComponent({
  spec,
  value,
  onChange,
  disabled,
  hintStrategy,
}: ComponentRendererProps<BuildStepsSpec>) {
  // value: Record<stepId, string>
  const stepValues: Record<string, string> = (
    value && typeof value === "object" && !Array.isArray(value)
  ) ? (value as Record<string, string>) : {};

  const [shownHints, setShownHints] = React.useState<Set<string>>(
    hintStrategy === "always" ? new Set(spec.steps.map((s) => s.id)) : new Set(),
  );

  function setStepValue(stepId: string, text: string) {
    onChange(spec.id, { ...stepValues, [stepId]: text });
  }

  function toggleHint(stepId: string) {
    setShownHints((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }

  const currentStepIdx = spec.steps.findIndex((s) => !stepValues[s.id]);
  const activeIdx = currentStepIdx === -1 ? spec.steps.length : currentStepIdx;

  return (
    <div className="flex flex-col gap-4">
      {spec.prompt && <p className="text-sm font-medium">{spec.prompt}</p>}

      {spec.workedExample && (
        <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Worked example
          </p>
          <p className="text-sm whitespace-pre-wrap">{spec.workedExample}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {spec.steps.map((step, idx) => {
          const isActive = idx <= activeIdx;
          const isDone = !!stepValues[step.id];
          const showHint = shownHints.has(step.id);

          return (
            <div
              key={step.id}
              className={cn(
                "rounded-lg border p-4 flex flex-col gap-2 transition-opacity",
                !isActive && "opacity-40 pointer-events-none",
                isDone
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card/70",
              )}
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                  {idx + 1}
                </span>
                <p className="text-sm font-medium leading-relaxed">{step.instruction}</p>
              </div>

              {isActive && !isDone && (
                <div className="pl-7">
                  <input
                    type="text"
                    value={stepValues[step.id] ?? ""}
                    onChange={(e) => setStepValue(step.id, e.target.value)}
                    disabled={disabled}
                    placeholder={step.expectedValue ? `Expected: ${step.expectedValue}` : "Your answer…"}
                    className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring disabled:opacity-60"
                  />
                </div>
              )}

              {isDone && (
                <div className="pl-7">
                  <p className="text-sm text-primary/80">{stepValues[step.id]}</p>
                </div>
              )}

              {step.hint && isActive && (
                <div className="pl-7">
                  <button
                    type="button"
                    onClick={() => toggleHint(step.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="size-3.5" />
                    {showHint ? "Hide hint" : "Show hint"}
                  </button>
                  {showHint && (
                    <p className="mt-1 text-xs text-muted-foreground italic">{step.hint}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag arrange (free-form ordering)
// ---------------------------------------------------------------------------

export function DragArrangeComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<DragArrangeSpec>) {
  const currentOrder: string[] = Array.isArray(value)
    ? (value as string[])
    : spec.items.map((i) => i.id);

  const orderedItems = currentOrder
    .map((id) => spec.items.find((i) => i.id === id))
    .filter(Boolean) as (typeof spec.items)[number][];

  function moveUp(idx: number) {
    if (idx === 0 || disabled) return;
    const next = [...currentOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(spec.id, next);
  }

  function moveDown(idx: number) {
    if (idx === currentOrder.length - 1 || disabled) return;
    const next = [...currentOrder];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(spec.id, next);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      <div className="flex flex-col gap-2">
        {orderedItems.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card/70 px-4 py-2.5"
          >
            <GripVertical className="size-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm">{item.text}</span>
            {!disabled && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 px-1"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === orderedItems.length - 1}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 px-1"
                >
                  ▼
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {spec.hint && <p className="text-xs text-muted-foreground italic">{spec.hint}</p>}
    </div>
  );
}
