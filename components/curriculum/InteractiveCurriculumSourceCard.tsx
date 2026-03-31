"use client";

import * as React from "react";
import { CurriculumSourceCard } from "./CurriculumSourceCard";
import type { CurriculumSource } from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";

export interface InteractiveCurriculumSourceCardProps
  extends Omit<React.ComponentProps<"button">, "onSelect"> {
  source: CurriculumSource;
  selected?: boolean;
  onSelect?: (source: CurriculumSource) => void;
  cardClassName?: string;
}

export function InteractiveCurriculumSourceCard({
  source,
  selected,
  onSelect,
  className,
  cardClassName,
  type = "button",
  onClick,
  onKeyDown,
  ...props
}: InteractiveCurriculumSourceCardProps) {
  return (
    <button
      type={type}
      className={cn(
        "block w-full rounded-3xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onSelect?.(source);
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(source);
        }
      }}
      {...props}
    >
      <CurriculumSourceCard
        source={source}
        selected={selected}
        className={cn("h-full cursor-pointer", cardClassName)}
      />
    </button>
  );
}
