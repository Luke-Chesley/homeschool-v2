import Link from "next/link";
import { CalendarClock, LayoutDashboard, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
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
  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-6 pb-16 pt-8 sm:px-8 lg:px-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 px-6 py-10 shadow-[var(--shadow-hero)] backdrop-blur sm:px-8 lg:px-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
        <div className="absolute left-0 top-0 size-56 -translate-x-1/3 -translate-y-1/3 rounded-full bg-secondary/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-64 translate-x-1/3 translate-y-1/3 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="mb-4">Planning Workspace</Badge>
            <h1 className="font-serif text-4xl leading-[0.95] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              {description}
            </p>
          </div>

          <Card className="w-full max-w-xl border-primary/15 bg-background/88">
            <CardContent className="grid gap-3 p-4 md:grid-cols-3">
              {navItems.map(({ href, label, view, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    buttonVariants({
                      variant: currentView === view ? "default" : "outline",
                    }),
                    "min-h-24 w-full items-start justify-start rounded-3xl px-4 py-4 text-left text-sm leading-5 whitespace-normal"
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0 text-balance">{label}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="mt-8">{children}</div>
    </main>
  );
}
