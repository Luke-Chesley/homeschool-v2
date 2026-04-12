"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { StudioToggle } from "@/components/studio/StudioToggle";
import { Button, buttonVariants } from "@/components/ui/button";

type ParentTopbarProps = {
  activeLearnerName: string;
  learnerLabel: string;
  onOpenMenu: () => void;
};

export function ParentTopbar({ activeLearnerName, learnerLabel, onOpenMenu }: ParentTopbarProps) {
  const pathname = usePathname();

  return (
    <div className="sticky top-[var(--global-tabs-height)] z-30 border-b border-border/70 bg-background/92 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">
            {learnerLabel} · {activeLearnerName}
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
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

          <StudioToggle />

          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm" className="gap-2">
              <LogOut className="size-4" />
              Sign out
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
  );
}
