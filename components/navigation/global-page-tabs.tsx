"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const globalPageTabs = [
  { href: "/", label: "Landing", matchPrefix: "/" },
  { href: "/today", label: "Today", matchPrefix: "/today" },
  { href: "/curriculum", label: "Curriculum", matchPrefix: "/curriculum" },
  { href: "/planning", label: "Planning", matchPrefix: "/planning" },
  { href: "/tracking", label: "Tracking", matchPrefix: "/tracking" },
  { href: "/copilot", label: "Copilot", matchPrefix: "/copilot" },
  { href: "/users", label: "Users", matchPrefix: "/users" },
  {
    href: "/sample-activity",
    label: "Sample Activity",
    matchPrefix: "/sample-activity",
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
    <div className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[var(--global-tabs-height)] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <nav className="flex min-w-0 items-center gap-2 overflow-x-auto" aria-label="Global sections">
          {globalPageTabs.map((tab) => {
            const active =
              tab.href === "/sample-activity"
                ? pathname.startsWith("/activity") || pathname.startsWith("/sample-activity")
                : isActive(pathname, tab.href, tab.matchPrefix);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                  active
                    ? "border-primary/25 bg-primary/12 text-foreground shadow-[var(--shadow-active)]"
                    : "border-border/50 bg-card/55 text-muted-foreground hover:border-border/70 hover:bg-card/80 hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
      </div>
    </div>
  );
}
