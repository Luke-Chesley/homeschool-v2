"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { StudioToggle } from "@/components/studio/StudioToggle";
import { Button, buttonVariants } from "@/components/ui/button";

type ParentTopbarProps = {
  activeLearnerName: string;
  learnerLabel: string;
  onOpenMenu: () => void;
};

function toWeekStartDate(inputDate?: string) {
  const base = inputDate ? new Date(`${inputDate}T12:00:00.000Z`) : new Date();
  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const normalized = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const weekday = normalized.getUTCDay();
  const offset = (weekday + 6) % 7;
  normalized.setUTCDate(normalized.getUTCDate() - offset);
  return normalized.toISOString().slice(0, 10);
}

function getPlanningControls(pathname: string, searchParams: URLSearchParams) {
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const weekStartDate = searchParams.get("weekStartDate") ?? toWeekStartDate(date);
  const dayDateMatch = pathname.match(/^\/planning\/day\/([^/]+)/);
  const dayDate = dayDateMatch?.[1] ?? date;

  const monthParams = new URLSearchParams();
  monthParams.set("month", date);

  const weekParams = new URLSearchParams();
  weekParams.set("weekStartDate", weekStartDate);

  const dayParams = new URLSearchParams();

  const todayParams = new URLSearchParams();
  todayParams.set("date", date);

  return [
    {
      href: `/planning/month?${monthParams.toString()}`,
      label: "Month planning",
      active: pathname.startsWith("/planning/month"),
    },
    {
      href: `/planning?${weekParams.toString()}`,
      label: "Weekly planning",
      active: pathname === "/planning",
    },
    {
      href: `/planning/day/${dayDate}${dayParams.toString() ? `?${dayParams.toString()}` : ""}`,
      label: "Daily plan",
      active: pathname.startsWith("/planning/day/"),
    },
    {
      href: `/today?${todayParams.toString()}`,
      label: "Today workspace",
      active: pathname.startsWith("/today"),
    },
  ] as const;
}

export function ParentTopbar({ activeLearnerName, learnerLabel, onOpenMenu }: ParentTopbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const planningControls =
    pathname.startsWith("/today") || pathname.startsWith("/planning")
      ? getPlanningControls(pathname, new URLSearchParams(searchParams.toString()))
      : [];

  return (
    <div className="sticky top-[var(--global-tabs-height)] z-30 border-b border-border/70 bg-background/92 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {learnerLabel} · {activeLearnerName}
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            {pathname.startsWith("/curriculum") ? (
              <>
                <Link
                  href="/curriculum/manage"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Manage sources
                </Link>
                <Link
                  href="/curriculum/new"
                  className={buttonVariants({ variant: "default", size: "sm" })}
                >
                  Add curriculum
                </Link>
              </>
            ) : null}

            <StudioToggle />

            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm" className="gap-2">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>

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

        {planningControls.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3">
            {planningControls.map((control) => (
              <Link
                key={control.href}
                href={control.href}
                className={
                  control.active
                    ? "text-sm text-foreground"
                    : "text-sm text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {control.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
