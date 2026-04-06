"use client";

/**
 * Reflection, self-assessment, and evidence capture components.
 * reflection_prompt, rubric_self_check, confidence_check (already in InputComponents),
 * compare_and_explain, choose_next_step, construction_space
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ComponentRendererProps } from "./types";
import type {
  ReflectionPromptComponentSchema,
  RubricSelfCheckComponentSchema,
  CompareAndExplainComponentSchema,
  ChooseNextStepComponentSchema,
  ConstructionSpaceComponentSchema,
} from "@/lib/activities/components";
import type { z } from "zod";

type ReflectionPromptSpec = z.infer<typeof ReflectionPromptComponentSchema>;
type RubricSelfCheckSpec = z.infer<typeof RubricSelfCheckComponentSchema>;
type CompareAndExplainSpec = z.infer<typeof CompareAndExplainComponentSchema>;
type ChooseNextStepSpec = z.infer<typeof ChooseNextStepComponentSchema>;
type ConstructionSpaceSpec = z.infer<typeof ConstructionSpaceComponentSchema>;

// ---------------------------------------------------------------------------
// Reflection prompt
// ---------------------------------------------------------------------------

export function ReflectionPromptComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<ReflectionPromptSpec>) {
  // value: Record<subPromptId, string | number>
  const responses: Record<string, unknown> = (
    value && typeof value === "object" && !Array.isArray(value)
  ) ? (value as Record<string, unknown>) : {};

  function setResponse(subId: string, val: unknown) {
    onChange(spec.id, { ...responses, [subId]: val });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold">{spec.prompt}</p>
      {spec.subPrompts.map((sub) => (
        <div key={sub.id} className="flex flex-col gap-2">
          <label className="text-sm text-foreground/90 leading-relaxed">{sub.text}</label>
          {sub.responseKind === "rating" ? (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => setResponse(sub.id, n)}
                  className={cn(
                    "size-9 rounded-full border text-sm font-medium transition-colors",
                    responses[sub.id] === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/70 hover:bg-muted",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              value={typeof responses[sub.id] === "string" ? (responses[sub.id] as string) : ""}
              onChange={(e) => setResponse(sub.id, e.target.value)}
              disabled={disabled}
              rows={3}
              placeholder="Write your response here…"
              className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rubric self-check
// ---------------------------------------------------------------------------

export function RubricSelfCheckComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<RubricSelfCheckSpec>) {
  // value: { scores: Record<criterionId, levelValue>, notes: string }
  type RubricValue = { scores: Record<string, number>; notes: string };
  const current: RubricValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as RubricValue)
      : { scores: {}, notes: "" };

  function setScore(criterionId: string, levelValue: number) {
    onChange(spec.id, {
      ...current,
      scores: { ...current.scores, [criterionId]: levelValue },
    });
  }

  function setNotes(notes: string) {
    onChange(spec.id, { ...current, notes });
  }

  return (
    <div className="flex flex-col gap-4">
      {spec.prompt && <p className="text-sm font-semibold">{spec.prompt}</p>}

      {/* Level header */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground pr-4 pb-2 text-xs">
                Criterion
              </th>
              {spec.levels.map((level) => (
                <th
                  key={level.value}
                  className="text-center font-medium text-muted-foreground pb-2 text-xs min-w-[80px]"
                >
                  {level.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.criteria.map((criterion) => (
              <tr key={criterion.id} className="border-t border-border/50">
                <td className="py-3 pr-4">
                  <p className="font-medium text-sm">{criterion.label}</p>
                  {criterion.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{criterion.description}</p>
                  )}
                </td>
                {spec.levels.map((level) => {
                  const isSelected = current.scores[criterion.id] === level.value;
                  return (
                    <td key={level.value} className="py-3 text-center">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setScore(criterion.id, level.value)}
                        className={cn(
                          "mx-auto size-8 rounded-full border transition-colors text-xs font-medium",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card/70 hover:bg-muted",
                        )}
                        title={level.description}
                      >
                        {level.value}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {spec.notePrompt && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">{spec.notePrompt}</label>
          <textarea
            value={current.notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="Notes…"
            className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compare and explain
// ---------------------------------------------------------------------------

export function CompareAndExplainComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<CompareAndExplainSpec>) {
  const text = typeof value === "string" ? value : "";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">A</p>
          <p className="text-sm">{spec.itemA}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">B</p>
          <p className="text-sm">{spec.itemB}</p>
        </div>
      </div>
      <label className="text-sm text-muted-foreground">
        {spec.responsePrompt ?? "Explain how A and B are similar and different:"}
      </label>
      <textarea
        value={text}
        onChange={(e) => onChange(spec.id, e.target.value)}
        disabled={disabled}
        rows={4}
        placeholder="Your comparison…"
        className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Choose next step
// ---------------------------------------------------------------------------

export function ChooseNextStepComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<ChooseNextStepSpec>) {
  const selected = typeof value === "string" ? value : "";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      <div className="flex flex-col gap-2">
        {spec.choices.map((choice) => {
          const isSelected = selected === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(spec.id, choice.id)}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                isSelected
                  ? "border-primary bg-primary/8"
                  : "border-border bg-card/60 hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 size-4 shrink-0 rounded-full border transition-colors",
                  isSelected ? "border-primary bg-primary" : "border-border",
                )}
              />
              <span>
                <span className="font-medium">{choice.label}</span>
                {choice.description && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {choice.description}
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
// Construction space
// ---------------------------------------------------------------------------

export function ConstructionSpaceComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<ConstructionSpaceSpec>) {
  const text = typeof value === "string" ? value : "";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      {spec.scaffoldText && (
        <div className="rounded-lg border border-border/50 bg-muted/40 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
          {spec.scaffoldText}
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => onChange(spec.id, e.target.value)}
        disabled={disabled}
        rows={6}
        placeholder={spec.hint ?? "Build your response here…"}
        className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
      />
    </div>
  );
}
