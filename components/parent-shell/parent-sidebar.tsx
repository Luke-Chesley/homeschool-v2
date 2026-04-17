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
    <div className="flex h-full flex-col bg-background/50 px-4 py-5">
      <div className="rounded-xl border border-border/70 bg-card/88 p-4 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold text-foreground">{organizationName}</p>
        <div className="mt-3 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Active {learnerLabel.toLowerCase()}
          </p>
          <p className="truncate text-sm font-medium text-foreground" title={activeLearnerName}>
            {activeLearnerName}
          </p>
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
