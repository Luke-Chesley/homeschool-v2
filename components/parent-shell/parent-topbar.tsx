"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { parentPrimaryNav } from "@/components/navigation/parent-nav-config";
import { StudioToggle } from "@/components/studio/StudioToggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const activeSection =
    parentPrimaryNav.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.matchPrefix}/`),
    ) ?? parentPrimaryNav[0];
  const planningControls =
    pathname.startsWith("/today") || pathname.startsWith("/planning")
      ? getPlanningControls(pathname, new URLSearchParams(searchParams.toString()))
      : [];

  return (
    <div className="border-b border-border/70 bg-background/96 px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {learnerLabel} · {activeLearnerName}
          </p>
          <h1 className="font-serif text-2xl leading-tight">{activeSection.label}</h1>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
          {planningControls.map((control) => (
            <Link
              key={control.href}
              href={control.href}
              className={cn(
                buttonVariants({ variant: control.active ? "secondary" : "outline", size: "sm" }),
                "shrink-0",
              )}
            >
              {control.label}
            </Link>
          ))}

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
    </div>
  );
}
