"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { StudioToggle } from "@/components/studio/StudioToggle";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { ActiveLearnerSwitcher } from "@/components/users/active-learner-switcher";

type ParentTopbarProps = {
  activeLearnerId: string;
  activeLearnerName: string;
  learnerLabel: string;
  learners: Array<{
    id: string;
    displayName: string;
    status: string;
  }>;
  mobileMenuOpen: boolean;
  onToggleMenu: () => void;
};

export function ParentTopbar({
  activeLearnerId,
  activeLearnerName,
  learnerLabel,
  learners,
  mobileMenuOpen,
  onToggleMenu,
}: ParentTopbarProps) {
  const pathname = usePathname();
  const hasMultipleLearners = learners.length > 1;

  return (
    <div className="native-shell-top-inset sticky top-[var(--global-tabs-height)] z-30 border-b border-border/70 bg-background/92 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 rounded-2xl border border-border/70 bg-card/78 px-4 py-3 shadow-[var(--shadow-soft)]">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {hasMultipleLearners ? learnerLabel : `Viewing ${learnerLabel.toLowerCase()}`}
          </p>
          <p className="mt-1 truncate text-base font-semibold text-foreground" title={activeLearnerName}>
            {activeLearnerName}
          </p>
          {hasMultipleLearners ? (
            <p
              className="mt-2 max-w-full truncate text-xs text-muted-foreground"
            >
              Switch learners without losing your place in Today.
            </p>
          ) : null}
        </div>

        {hasMultipleLearners ? (
          <ActiveLearnerSwitcher
            learners={learners}
            activeLearnerId={activeLearnerId}
            label={`Switch ${learnerLabel.toLowerCase()}`}
            labelClassName="text-[10px]"
            selectClassName="h-10 text-sm"
          />
        ) : null}

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
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
            <ThemeToggle compact />
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
              aria-controls="parent-mobile-navigation"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
              onClick={onToggleMenu}
            >
              <Menu className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
