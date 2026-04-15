"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { StudioToggle } from "@/components/studio/StudioToggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { ActiveLearnerSwitcher } from "@/components/users/active-learner-switcher";
import { cn } from "@/lib/utils";

type ParentTopbarProps = {
  activeLearnerId: string;
  activeLearnerName: string;
  learnerLabel: string;
  learners: Array<{
    id: string;
    displayName: string;
    status: string;
  }>;
  onOpenMenu: () => void;
};

export function ParentTopbar({
  activeLearnerId,
  activeLearnerName,
  learnerLabel,
  learners,
  onOpenMenu,
}: ParentTopbarProps) {
  const pathname = usePathname();

  return (
    <div className="native-shell-top-inset sticky top-[var(--global-tabs-height)] z-30 border-b border-border/70 bg-background/92 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">
            {learnerLabel} · {activeLearnerName}
          </p>
        </div>

        {learners.length > 1 ? (
          <ActiveLearnerSwitcher
            learners={learners}
            activeLearnerId={activeLearnerId}
            label={`Switch ${learnerLabel.toLowerCase()}`}
            labelClassName="text-[10px]"
            selectClassName="h-10 text-sm"
          />
        ) : null}

        <div className={cn("flex min-w-0 flex-wrap items-center gap-2", learners.length > 1 ? "justify-between" : "justify-between")}>
          {pathname.startsWith("/curriculum") ? (
            <>
              <Link
                href="/curriculum/manage"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Sources
              </Link>
              <Link
                href="/curriculum/new"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Add
              </Link>
            </>
          ) : null}

          <div className="flex items-center gap-2">
            <StudioToggle />

            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm" className="gap-2">
                <LogOut className="size-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            </form>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              onClick={onOpenMenu}
            >
              <Menu className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
