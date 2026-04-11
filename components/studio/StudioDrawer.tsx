"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { useStudio } from "@/components/studio/studio-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StudioDrawer({
  panelId,
  title,
  description,
  children,
}: {
  panelId: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { activePanel, closePanel, isEnabled } = useStudio();
  const open = isEnabled && activePanel === panelId;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-foreground/20" onClick={closePanel} />
      <aside
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-border/70 bg-background shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div className="min-w-0 space-y-1">
            <h2 className="font-serif text-2xl text-foreground">{title}</h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close studio panel" onClick={closePanel}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}
