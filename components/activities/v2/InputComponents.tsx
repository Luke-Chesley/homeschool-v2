"use client";

/**
 * Simple input components.
 * short_answer, text_response, rich_text_response, single_select, multi_select,
 * rating, confidence_check
 */

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentRendererProps } from "./types";
import type {
  ShortAnswerComponentSchema,
  TextResponseComponentSchema,
  RichTextResponseComponentSchema,
  SingleSelectComponentSchema,
  MultiSelectComponentSchema,
  RatingComponentSchema,
  ConfidenceCheckComponentSchema,
} from "@/lib/activities/components";
import type { z } from "zod";

type ShortAnswerSpec = z.infer<typeof ShortAnswerComponentSchema>;
type TextResponseSpec = z.infer<typeof TextResponseComponentSchema>;
type RichTextResponseSpec = z.infer<typeof RichTextResponseComponentSchema>;
type SingleSelectSpec = z.infer<typeof SingleSelectComponentSchema>;
type MultiSelectSpec = z.infer<typeof MultiSelectComponentSchema>;
type RatingSpec = z.infer<typeof RatingComponentSchema>;
type ConfidenceCheckSpec = z.infer<typeof ConfidenceCheckComponentSchema>;

export function ShortAnswerComponent({
  spec,
  value,
  onChange,
  disabled,
  hintStrategy,
}: ComponentRendererProps<ShortAnswerSpec>) {
  const [showHint, setShowHint] = React.useState(hintStrategy === "always");
  const textValue = typeof value === "string" ? value : "";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium leading-relaxed">{spec.prompt}</label>
      <input
        type="text"
        value={textValue}
        onChange={(e) => onChange(spec.id, e.target.value)}
        disabled={disabled}
        placeholder={spec.placeholder ?? "Your answer…"}
        className="rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
      {spec.hint && (
        <HintToggle
          hint={spec.hint}
          shown={showHint}
          onToggle={() => setShowHint((s) => !s)}
          strategy={hintStrategy}
        />
      )}
    </div>
  );
}

export function TextResponseComponent({
  spec,
  value,
  onChange,
  disabled,
  hintStrategy,
}: ComponentRendererProps<TextResponseSpec>) {
  const [showHint, setShowHint] = React.useState(hintStrategy === "always");
  const textValue = typeof value === "string" ? value : "";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium leading-relaxed">{spec.prompt}</label>
      <textarea
        value={textValue}
        onChange={(e) => onChange(spec.id, e.target.value)}
        disabled={disabled}
        rows={4}
        placeholder={spec.placeholder ?? "Write your response…"}
        className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
      />
      {spec.hint && (
        <HintToggle
          hint={spec.hint}
          shown={showHint}
          onToggle={() => setShowHint((s) => !s)}
          strategy={hintStrategy}
        />
      )}
    </div>
  );
}

export function RichTextResponseComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<RichTextResponseSpec>) {
  const textValue = typeof value === "string" ? value : "";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium leading-relaxed">{spec.prompt}</label>
      <textarea
        value={textValue}
        onChange={(e) => onChange(spec.id, e.target.value)}
        disabled={disabled}
        rows={6}
        placeholder="Write your response here…"
        className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
      />
      {spec.hint && (
        <p className="text-xs text-muted-foreground italic">{spec.hint}</p>
      )}
    </div>
  );
}

export function SingleSelectComponent({
  spec,
  value,
  onChange,
  disabled,
  hintStrategy,
}: ComponentRendererProps<SingleSelectSpec>) {
  const [showHint, setShowHint] = React.useState(hintStrategy === "always");
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
                "flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors",
                isSelected
                  ? "border-primary bg-primary/8 text-primary font-medium"
                  : "border-border bg-card/60 hover:bg-muted/60 disabled:cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "size-4 shrink-0 rounded-full border transition-colors",
                  isSelected ? "border-primary bg-primary" : "border-border",
                )}
              />
              {choice.text}
            </button>
          );
        })}
      </div>
      {spec.hint && (
        <HintToggle
          hint={spec.hint}
          shown={showHint}
          onToggle={() => setShowHint((s) => !s)}
          strategy={hintStrategy}
        />
      )}
    </div>
  );
}

export function MultiSelectComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<MultiSelectSpec>) {
  const selected: string[] = Array.isArray(value) ? (value as string[]) : [];

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    onChange(spec.id, next);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      <div className="flex flex-col gap-2">
        {spec.choices.map((choice) => {
          const isSelected = selected.includes(choice.id);
          return (
            <button
              key={choice.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(choice.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors",
                isSelected
                  ? "border-primary bg-primary/8 text-primary font-medium"
                  : "border-border bg-card/60 hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "size-4 shrink-0 rounded border transition-colors",
                  isSelected ? "border-primary bg-primary" : "border-border",
                )}
              />
              {choice.text}
            </button>
          );
        })}
      </div>
      {spec.hint && <p className="text-xs text-muted-foreground italic">{spec.hint}</p>}
    </div>
  );
}

export function RatingComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<RatingSpec>) {
  const min = spec.min ?? 1;
  const max = spec.max ?? 5;
  const selected = typeof value === "number" ? value : null;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      <div className="flex items-center gap-2">
        {spec.lowLabel && (
          <span className="text-xs text-muted-foreground shrink-0">{spec.lowLabel}</span>
        )}
        <div className="flex gap-1.5 flex-1 justify-center">
          {steps.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(spec.id, n)}
              className={cn(
                "size-9 rounded-full border text-sm font-medium transition-colors",
                selected === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/70 hover:bg-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {spec.highLabel && (
          <span className="text-xs text-muted-foreground shrink-0">{spec.highLabel}</span>
        )}
      </div>
    </div>
  );
}

export function ConfidenceCheckComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<ConfidenceCheckSpec>) {
  const selected = typeof value === "number" ? value : null;
  const labels = spec.labels ?? ["Not yet", "A little", "Getting there", "Pretty good", "Got it!"];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">
        {spec.prompt ?? "How confident are you with this?"}
      </p>
      <div className="flex gap-2 flex-wrap">
        {labels.map((label, i) => {
          const val = i + 1;
          return (
            <button
              key={val}
              type="button"
              disabled={disabled}
              onClick={() => onChange(spec.id, val)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                selected === val
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/70 hover:bg-muted",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared hint toggle
// ---------------------------------------------------------------------------

function HintToggle({
  hint,
  shown,
  onToggle,
  strategy,
}: {
  hint: string;
  shown: boolean;
  onToggle: () => void;
  strategy?: "on_request" | "always" | "after_wrong_attempt";
}) {
  if (strategy === "always") {
    return <p className="text-xs text-muted-foreground italic">{hint}</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="size-3.5" />
        {shown ? "Hide hint" : "Show hint"}
      </button>
      {shown && <p className="mt-1 text-xs text-muted-foreground italic">{hint}</p>}
    </div>
  );
}
