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
        <div className="mt-4 space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground">
            Active {learnerLabel.toLowerCase()}
          </p>
          <p className="text-sm font-medium text-foreground">{activeLearnerName}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Keep the day light enough to run and detailed enough to trust.
          </p>
        </div>
      </div>

      <div className="mt-4 flex-1">
        <ParentNav onNavigate={onNavigate} />
      </div>

      <div className="mt-4 rounded-xl border border-border/70 bg-card/80 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Shortcuts</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Jump back to the daily workspace or open Copilot without hunting through extra chrome.
          </p>
        </div>
        <div className="grid gap-2">
          <Link
            href="/today"
            onClick={onNavigate}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-4 w-full justify-start")}
          >
            Open today
          </Link>
          <Link
            href="/copilot"
            onClick={onNavigate}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-start")}
          >
            Open Copilot
          </Link>
        </div>
      </div>
    </div>
  );
}
