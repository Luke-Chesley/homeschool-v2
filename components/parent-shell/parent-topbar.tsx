"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { parentPrimaryNav } from "@/components/navigation/parent-nav-config";

type ParentTopbarProps = {
  activeLearnerName: string;
  onOpenMenu: () => void;
};

export function ParentTopbar({ activeLearnerName, onOpenMenu }: ParentTopbarProps) {
  const pathname = usePathname();
  const activeSection =
    parentPrimaryNav.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.matchPrefix}/`),
    ) ?? parentPrimaryNav[0];

  return (
    <div className="border-b border-border/70 bg-background/96 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{activeLearnerName}</p>
          <h1 className="font-serif text-2xl leading-tight">{activeSection.label}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/today" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
            Daily view
          </Link>
          <Link href="/copilot" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
            AI
          </Link>
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
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
