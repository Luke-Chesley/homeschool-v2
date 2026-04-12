"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const publicTabs = [
  { href: "/", label: "Home", matchPrefix: "/" },
  { href: "/auth/login", label: "Sign in", matchPrefix: "/auth" },
] as const;

function isActive(pathname: string, href: string, matchPrefix: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${matchPrefix}/`);
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

  return (
    <div className="sticky top-0 z-40 border-b border-border/70 bg-background/92 backdrop-blur">
      <div className="mx-auto flex h-[var(--global-tabs-height)] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
            Homeschool V2
          </Link>
          {inWorkspace ? (
            <p className="hidden text-sm text-muted-foreground md:block">
              Calm planning, curriculum, and teaching support in one workspace.
            </p>
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
        <ThemeToggle />
      </div>
    </div>
  );
}
