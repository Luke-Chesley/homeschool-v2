"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import { StudioToggle } from "@/components/studio/StudioToggle";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { ActiveLearnerSwitcher } from "@/components/users/active-learner-switcher";
import { cn } from "@/lib/utils";

const publicTabs = [
  { href: "/", label: "Home", matchPrefix: "/" },
  { href: "/auth/login", label: "Sign in", matchPrefix: "/auth" },
] as const;

const workspaceTabs = [
  { href: "/today", label: "Today", matchPrefix: "/today" },
  { href: "/users", label: "Learners", matchPrefix: "/users" },
  { href: "/account", label: "Account", matchPrefix: "/account" },
] as const;

const workspaceLabels: Array<{ match: string; label: string }> = [
  { match: "/today", label: "Today" },
  { match: "/planning", label: "Planning" },
  { match: "/curriculum", label: "Curriculum" },
  { match: "/tracking", label: "Tracking" },
  { match: "/copilot", label: "Copilot" },
  { match: "/account", label: "Account" },
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

type WorkspaceSnapshot = {
  activeLearner?: { id?: string | null; displayName?: string | null } | null;
  learners?: Array<{ id: string; displayName: string; status: string }>;
  organization?: { name?: string | null } | null;
};

export function GlobalPageTabs() {
  const pathname = usePathname();
  const isLearnerRoute = pathname.startsWith("/learner") || pathname.startsWith("/activity");
  const inWorkspace =
    pathname.startsWith("/today") ||
    pathname.startsWith("/planning") ||
    pathname.startsWith("/curriculum") ||
    pathname.startsWith("/tracking") ||
    pathname.startsWith("/copilot") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/learner") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/onboarding");
  const workspaceLabel = getWorkspaceLabel(pathname);
  const [session, setSession] = useState<WorkspaceSnapshot | null>(null);

  useEffect(() => {
    if (!inWorkspace) {
      setSession(null);
      return;
    }

    let cancelled = false;
    fetch("/api/app-session", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled) {
          setSession(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inWorkspace]);

  if (isLearnerRoute) {
    return null;
  }

  const learners = session?.learners ?? [];
  const activeLearnerId = session?.activeLearner?.id ?? null;
  const activeLearnerName = session?.activeLearner?.displayName ?? null;
  const hasMultipleLearners = learners.length > 1;
  const hasActiveLearner = !!activeLearnerName;
  const switchLabel = hasMultipleLearners ? "Switch learners" : "Switch learner";
  const contextLabel = workspaceLabel ?? "Workspace";

  return (
    <div
      data-global-tabs
      className="native-shell-top-inset sticky top-0 z-40 border-b border-border/70 bg-background/92 backdrop-blur"
    >
      <div className="mx-auto grid h-[var(--global-tabs-height)] max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="shrink-0 text-[15px] font-semibold tracking-tight text-foreground">
            Homeschool V2
          </Link>
        </div>
        <div className="flex min-w-0 items-center justify-center">
          {inWorkspace ? (
            <nav
              className="hidden min-w-0 items-center gap-2 overflow-x-auto rounded-full border border-border/70 bg-card/76 px-2 py-1 md:flex"
              aria-label="Workspace sections"
            >
              {workspaceTabs.map((tab) => {
                const active = isActive(pathname, tab.href, tab.matchPrefix);

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-background font-semibold text-foreground shadow-[var(--shadow-soft)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          ) : (
            <nav className="flex min-w-0 items-center gap-6 overflow-x-auto" aria-label="Global sections">
              {publicTabs.map((tab) => {
                const active = isActive(pathname, tab.href, tab.matchPrefix);

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "inline-flex shrink-0 items-center text-sm transition-colors",
                      active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 lg:gap-5">
          {inWorkspace ? (
            <>
              <div className="hidden min-w-0 items-center gap-3 lg:flex">
                <div className="min-w-0 truncate text-sm">
                  <span className="text-muted-foreground">Viewing </span>
                  <span className="font-medium text-foreground">{contextLabel}</span>
                  {hasActiveLearner && !hasMultipleLearners ? (
                    <>
                      <span className="text-muted-foreground"> for </span>
                      <span
                        className="inline-flex max-w-[14rem] truncate rounded-full border border-border/70 bg-card/78 px-2.5 py-0.5 align-middle text-foreground"
                        title={activeLearnerName}
                      >
                        {activeLearnerName}
                      </span>
                    </>
                  ) : null}
                </div>
                {hasMultipleLearners ? (
                  <>
                    <span className="text-sm text-muted-foreground">for</span>
                    <ActiveLearnerSwitcher
                      learners={learners}
                      activeLearnerId={activeLearnerId}
                      label={switchLabel}
                      className="min-w-[12rem] gap-0"
                      labelClassName="sr-only"
                      selectClassName="h-9 rounded-full bg-card/78"
                    />
                  </>
                ) : null}
                <div className="h-4 w-px bg-border/80" />
              </div>
              <div className="hidden lg:block">
                <ThemeToggle compact />
              </div>
              <div className="hidden lg:block">
                <StudioToggle />
              </div>
              <form action="/auth/signout" method="post" className="hidden lg:block">
                <Button type="submit" variant="ghost" size="sm" className="gap-2">
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <ThemeToggle compact />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
