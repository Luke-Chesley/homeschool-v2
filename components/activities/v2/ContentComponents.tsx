"use client";

/**
 * Display-only content components (no evidence captured).
 * heading, paragraph, callout, image, divider
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  HeadingComponentSchema,
  ParagraphComponentSchema,
  CalloutComponentSchema,
  ImageComponentSchema,
} from "@/lib/activities/components";
import type { z } from "zod";

type HeadingSpec = z.infer<typeof HeadingComponentSchema>;
type ParagraphSpec = z.infer<typeof ParagraphComponentSchema>;
type CalloutSpec = z.infer<typeof CalloutComponentSchema>;
type ImageSpec = z.infer<typeof ImageComponentSchema>;

export function HeadingComponent({ spec }: { spec: HeadingSpec }) {
  const level = spec.level ?? 2;
  const className = cn(
    "font-serif font-semibold tracking-tight text-foreground",
    level === 1 && "text-2xl",
    level === 2 && "text-xl",
    level === 3 && "text-lg",
    level === 4 && "text-base",
  );
  return React.createElement(`h${level}` as "h1" | "h2" | "h3" | "h4", { className }, spec.text);
}

export function ParagraphComponent({ spec }: { spec: ParagraphSpec }) {
  return (
    <p className="text-sm leading-7 text-foreground/90">{spec.text}</p>
  );
}

export function CalloutComponent({ spec }: { spec: CalloutSpec }) {
  const variants = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    tip: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    note: "border-border bg-muted/50 text-foreground",
  };
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", variants[spec.variant ?? "info"])}>
      {spec.text}
    </div>
  );
}

export function ImageComponent({ spec }: { spec: ImageSpec }) {
  return (
    <figure className="flex flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={spec.src}
        alt={spec.alt}
        className="rounded-lg border border-border/50 w-full object-cover"
      />
      {spec.caption && (
        <figcaption className="text-xs text-center text-muted-foreground">
          {spec.caption}
        </figcaption>
      )}
    </figure>
  );
}

export function DividerComponent() {
  return <hr className="border-border/50" />;
}
