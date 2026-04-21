import Link from "next/link";

import { ParentNav } from "@/components/navigation/parent-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ParentSidebar({
  activeLearnerName,
  organizationName,
  learnerLabel,
  onNavigate,
}: {
  activeLearnerName: string;
  organizationName: string;
  learnerLabel: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-background/40 px-4 py-5">
      <div className="shell-profile-panel">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{organizationName}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Keep the day, week, and record trail close together.
            </p>
          </div>
          <span className="rounded-full border border-border/70 bg-background/78 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Active
          </span>
        </div>
        <div className="mt-4 rounded-[calc(var(--radius)-0.1rem)] border border-border/70 bg-background/72 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Active {learnerLabel.toLowerCase()}
          </p>
          <p className="mt-2 truncate text-base font-semibold text-foreground" title={activeLearnerName}>
            {activeLearnerName}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-border/70 bg-card/76 px-2.5 py-1 text-[11px] text-muted-foreground">
              Today ready
            </span>
            <span className="rounded-full border border-border/70 bg-card/76 px-2.5 py-1 text-[11px] text-muted-foreground">
              One calm workspace
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex-1">
        <ParentNav onNavigate={onNavigate} />
      </div>

      <div className="mt-4 grid gap-2">
        <Link
          href="/today"
          onClick={onNavigate}
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full justify-start")}
        >
          Today
        </Link>
        <Link
          href="/copilot"
          onClick={onNavigate}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-start")}
        >
          Copilot
        </Link>
      </div>
    </div>
  );
}
