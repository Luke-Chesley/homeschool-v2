"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { ParentSidebar } from "@/components/parent-shell/parent-sidebar";
import { ParentTopbar } from "@/components/parent-shell/parent-topbar";
import { Button } from "@/components/ui/button";

export function ParentShell({
  children,
  activeLearnerId,
  activeLearnerName,
  learners,
  organizationName,
  learnerLabel,
}: {
  children: ReactNode;
  activeLearnerId: string;
  activeLearnerName: string;
  learners: Array<{
    id: string;
    displayName: string;
    status: string;
  }>;
  organizationName: string;
  learnerLabel: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-[calc(100dvh-var(--global-tabs-height))] w-full bg-background">
      <aside className="hidden w-[18rem] shrink-0 border-r border-border/70 bg-background/46 lg:block">
        <div className="sticky top-[var(--global-tabs-height)] h-[calc(100dvh-var(--global-tabs-height))] overflow-y-auto">
          <ParentSidebar
            activeLearnerName={activeLearnerName}
            organizationName={organizationName}
            learnerLabel={learnerLabel}
          />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ParentTopbar
          activeLearnerId={activeLearnerId}
          activeLearnerName={activeLearnerName}
          learnerLabel={learnerLabel}
          learners={learners}
          mobileMenuOpen={mobileOpen}
          onToggleMenu={() => setMobileOpen((current) => !current)}
        />

        <div className="min-h-0 flex-1">{children}</div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-foreground/20 transition-opacity lg:hidden">
          <div className="absolute inset-0" onClick={() => setMobileOpen(false)} />
          <div
            id="parent-mobile-navigation"
            className="absolute inset-y-0 left-0 w-[min(82vw,288px)] border-r border-border/70 bg-background"
          >
            <div className="flex h-14 items-center justify-end border-b border-border/70 px-4">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
              <ParentSidebar
                activeLearnerName={activeLearnerName}
                organizationName={organizationName}
                learnerLabel={learnerLabel}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
