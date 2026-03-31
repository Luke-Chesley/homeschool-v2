import Link from "next/link";
import { CalendarClock, LayoutDashboard, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PlanningShellProps {
  currentView: "week" | "day" | "today";
  title: string;
  description: string;
  children: ReactNode;
}

const navItems = [
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
}: PlanningShellProps) {
  const isTodayView = currentView === "today";

  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-6 pb-16 pt-8 sm:px-8 lg:px-10">
      <section
        className={cn(
          "relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 shadow-[var(--shadow-hero)] backdrop-blur",
          isTodayView ? "px-6 py-8 sm:px-8" : "px-6 py-10 sm:px-8 lg:px-10",
        )}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
        <div className="absolute left-0 top-0 size-56 -translate-x-1/3 -translate-y-1/3 rounded-full bg-secondary/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-64 translate-x-1/3 translate-y-1/3 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative flex flex-col gap-6">
          <div className="max-w-3xl">
            <Badge className="mb-4">Planning Workspace</Badge>
            <h1
              className={cn(
                "font-serif leading-[0.95] tracking-[-0.04em]",
                isTodayView ? "text-3xl sm:text-4xl lg:text-5xl" : "text-4xl sm:text-5xl lg:text-6xl",
              )}
            >
              {title}
            </h1>
            <p
              className={cn(
                "mt-4 max-w-2xl leading-8 text-muted-foreground",
                isTodayView ? "text-sm sm:text-base" : "text-base sm:text-lg",
              )}
            >
              {description}
            </p>
          </div>

          {isTodayView ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Today route</Badge>
              <Badge variant="outline">Active learner</Badge>
              <Badge variant="outline">Compact view</Badge>
            </div>
          ) : (
            <Card className="w-full max-w-5xl border-primary/15 bg-background/88">
              <CardContent className="grid gap-3 p-4 md:grid-cols-3">
                {navItems.map(({ href, label, view, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "group flex min-h-28 w-full flex-col items-start justify-between gap-6 rounded-[1.75rem] border px-5 py-5 text-left transition-colors",
                      currentView === view
                        ? "border-primary/25 bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card/70 text-foreground hover:bg-card",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-10 items-center justify-center rounded-2xl border transition-colors",
                        currentView === view
                          ? "border-primary-foreground/20 bg-primary-foreground/10"
                          : "border-border/70 bg-background/80",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                    </span>
                    <span className="min-w-0 text-base font-semibold leading-6">
                      {label}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <div className="mt-8">{children}</div>
    </main>
  );
}
