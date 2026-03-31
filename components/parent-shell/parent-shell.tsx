"use client";

import { X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { ParentSidebar } from "@/components/parent-shell/parent-sidebar";
import { ParentTopbar } from "@/components/parent-shell/parent-topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ParentShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100dvh-var(--global-tabs-height))] w-full gap-4 px-3 py-3 sm:px-4 lg:px-6">
      <aside className="hidden min-h-0 w-[350px] shrink-0 lg:block">
        <div className="sticky top-4 max-h-[calc(100dvh-var(--global-tabs-height)-2rem)] overflow-y-auto pr-1">
          <ParentSidebar />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <ParentTopbar onOpenMenu={() => setMobileOpen(true)} />

        <div className="min-h-0 flex-1">
          <Card className="min-h-0 min-w-0 border-border/70 bg-card/60 p-2 sm:p-3">
            <div className="min-h-full rounded-[1.4rem] bg-background/65">{children}</div>
          </Card>
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="absolute inset-0" onClick={() => setMobileOpen(false)} />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[min(92vw,360px)] p-3 transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Card className="relative h-full overflow-auto border-border/70 bg-card/96 p-2">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </Button>
            <ParentSidebar onNavigate={() => setMobileOpen(false)} />
          </Card>
        </div>
      </div>
    </div>
  );
}
