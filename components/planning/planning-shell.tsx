import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PlanningView = "month" | "week" | "day" | "today";

interface PlanningNavItem {
  href: string;
  label: string;
  view: PlanningView;
  icon: LucideIcon;
}

interface PlanningShellProps {
  currentView: PlanningView;
  title: string;
  description: string;
  children: ReactNode;
  navItems?: PlanningNavItem[];
  headerSupplement?: ReactNode;
}

const defaultNavItems = [
  {
    href: "/planning/month",
    label: "Month planning",
    view: "month" as const,
    icon: CalendarDays,
  },
  {
    href: "/planning",
    label: "Weekly planning",
    view: "week" as const,
    icon: CalendarClock,
  },
  {
    href: "/planning/day/2026-03-30",
    label: "Daily plan",
    view: "day" as const,
    icon: LayoutDashboard,
  },
  {
    href: "/today",
    label: "Today workspace",
    view: "today" as const,
    icon: Sparkles,
  },
];

export function PlanningShell({
  currentView,
  title,
  description,
  children,
  navItems: navItemsOverride,
  headerSupplement,
}: PlanningShellProps) {
  const resolvedNavItems = navItemsOverride ?? defaultNavItems;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 pb-12 pt-6 sm:px-6 lg:px-8">
      <section className="border-b border-border/70 pb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl leading-tight tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>

          <nav className="flex flex-wrap gap-1.5" aria-label="Planning views">
            {resolvedNavItems.map(({ href, label, view, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={currentView === view ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  currentView === view
                    ? "border-primary/25 bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {headerSupplement ? <div className="mt-4">{headerSupplement}</div> : null}
      </section>

      <div className="mt-6">{children}</div>
    </main>
  );
}
