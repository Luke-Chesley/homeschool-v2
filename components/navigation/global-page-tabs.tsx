"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const publicTabs = [
  { href: "/", label: "Home", matchPrefix: "/" },
  { href: "/auth/login", label: "Sign in", matchPrefix: "/auth" },
] as const;

const workspaceLabels: Array<{ match: string; label: string }> = [
  { match: "/today", label: "Today" },
  { match: "/planning", label: "Planning" },
  { match: "/curriculum", label: "Curriculum" },
  { match: "/tracking", label: "Tracking" },
  { match: "/copilot", label: "Copilot" },
  { match: "/users", label: "Learners" },
  { match: "/onboarding", label: "Setup" },
  { match: "/learner", label: "Learner" },
  { match: "/activity", label: "Activity" },
] as const;

function isActive(pathname: string, href: string, matchPrefix: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${matchPrefix}/`);
}

function getWorkspaceLabel(pathname: string) {
  return workspaceLabels.find((entry) => pathname === entry.match || pathname.startsWith(`${entry.match}/`))
    ?.label;
}

export function GlobalPageTabs() {
  const pathname = usePathname();
  const inWorkspace =
    pathname.startsWith("/today") ||
    pathname.startsWith("/planning") ||
    pathname.startsWith("/curriculum") ||
    pathname.startsWith("/tracking") ||
    pathname.startsWith("/copilot") ||
    pathname.startsWith("/learner") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/onboarding");
  const workspaceLabel = getWorkspaceLabel(pathname);

  return (
    <div className="sticky top-0 z-40 border-b border-border/70 bg-background/92 backdrop-blur">
      <div className="mx-auto flex h-[var(--global-tabs-height)] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
            Homeschool V2
          </Link>
          {inWorkspace ? (
            <div className="hidden items-center gap-2 text-sm md:flex">
              <Link href="/today" className="text-muted-foreground transition-colors hover:text-foreground">
                Workspace
              </Link>
              {workspaceLabel ? (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-foreground">{workspaceLabel}</span>
                </>
              ) : null}
            </div>
          ) : (
            <nav className="flex min-w-0 items-center gap-4 overflow-x-auto" aria-label="Global sections">
              {publicTabs.map((tab) => {
                const active = isActive(pathname, tab.href, tab.matchPrefix);

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "inline-flex shrink-0 items-center border-b border-transparent pb-0.5 text-sm transition-colors",
                      active
                        ? "border-foreground text-foreground"
                        : "text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          {inWorkspace ? (
            <>
              <Link
                href="/today"
                className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                Learning workspace
              </Link>
              <Link
                href="/users"
                className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                Learners
              </Link>
            </>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
