import Link from "next/link";

import { ParentNav } from "@/components/navigation/parent-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ParentSidebar({
  activeLearnerName,
  onNavigate,
}: {
  activeLearnerName: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border/70 px-5 py-5">
        <Link href="/today" className="inline-flex text-sm font-semibold text-foreground">
          Homeschool
        </Link>
        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted-foreground">Active learner</p>
          <p className="text-sm font-medium text-foreground">{activeLearnerName}</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        <ParentNav onNavigate={onNavigate} />
      </div>

      <div className="border-t border-border/70 px-4 py-4">
        <div className="grid gap-2">
          <Link
            href="/today"
            onClick={onNavigate}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full justify-start")}
          >
            Open today
          </Link>
          <Link
            href="/copilot"
            onClick={onNavigate}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-start")}
          >
            Ask AI
          </Link>
        </div>
      </div>
    </div>
  );
}
