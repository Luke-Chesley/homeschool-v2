"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/",
    label: "Overview",
    match: (pathname: string) => pathname === "/",
  },
  {
    href: "/planning",
    label: "Parent",
    match: (pathname: string) => pathname.startsWith("/planning") || pathname.startsWith("/today") || pathname.startsWith("/tracking") || pathname.startsWith("/curriculum") || pathname.startsWith("/copilot"),
  },
  {
    href: "/activity/session-quiz-001",
    label: "Learner",
    match: (pathname: string) => pathname.startsWith("/activity"),
  },
];

export function GlobalPageTabs() {
  const pathname = usePathname();
  const learnerHref = pathname.startsWith("/activity") ? pathname : "/activity/session-quiz-001";

  return (
    <div className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[var(--global-tabs-height)] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <nav className="flex min-w-0 items-center gap-2 overflow-x-auto" aria-label="Global sections">
          {tabs.map((tab) => {
            const href = tab.label === "Learner" ? learnerHref : tab.href;
            const active = tab.match(pathname);

            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
                  active
                    ? "border-primary/25 bg-primary/12 text-foreground shadow-[var(--shadow-active)]"
                    : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-card/80 hover:text-foreground",
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
