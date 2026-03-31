"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const globalPageTabs = [
  { href: "/", label: "Landing", matchPrefix: "/" },
  { href: "/today", label: "Today", matchPrefix: "/today" },
  { href: "/curriculum", label: "Curriculum", matchPrefix: "/curriculum" },
  { href: "/planning", label: "Planning", matchPrefix: "/planning" },
  { href: "/tracking", label: "Tracking", matchPrefix: "/tracking" },
  { href: "/copilot", label: "Copilot", matchPrefix: "/copilot" },
  {
    href: "/activity/session-quiz-001",
    label: "Sample Activity",
    matchPrefix: "/activity",
  },
] as const;

function isActive(pathname: string, href: string, matchPrefix: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${matchPrefix}/`);
}

export function GlobalPageTabs() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-40 border-b border-border/70 bg-background/92 backdrop-blur">
      <div className="flex w-full gap-2 overflow-x-auto px-4 py-3">
        {globalPageTabs.map((tab) => {
          const active = isActive(pathname, tab.href, tab.matchPrefix);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary/25 bg-primary/10 text-foreground"
                  : "border-border/70 bg-card/70 text-muted-foreground hover:bg-card hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
