"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Menu,
  PlayCircle,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type LandingNavItem = {
  href: string;
  label: string;
};

export type LandingFeature = {
  id: string;
  title: string;
  headline: string;
  description: string;
  bullets: string[];
  accent: string;
  stats: string[];
};

export function LandingHeader({
  navItems,
}: {
  navItems: LandingNavItem[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-[var(--global-tabs-height)] z-30 border-b border-border/60 bg-background/88 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl border border-border/70 bg-card/86 shadow-[var(--shadow-soft)]">
            <span className="font-serif text-lg tracking-[-0.04em] text-foreground">H2</span>
          </div>
          <div>
            <p className="font-medium text-foreground">Homeschool V2</p>
            <p className="text-xs text-muted-foreground">Planning built around the real day</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/auth/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link href="/auth/sign-up" className={buttonVariants({ size: "sm" })}>
            Create account
          </Link>
        </div>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="landing-mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="inline-flex size-10 items-center justify-center rounded-xl border border-border/70 bg-card/78 text-foreground shadow-[var(--shadow-soft)] md:hidden"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
        </button>
      </div>

      {menuOpen ? (
        <div
          id="landing-mobile-menu"
          className="border-t border-border/60 bg-background/94 px-5 py-4 shadow-[var(--shadow-card)] backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-card/80"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            <Link
              href="/auth/login"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className={cn(buttonVariants(), "w-full")}
              onClick={() => setMenuOpen(false)}
            >
              Create account
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function DemoModal({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2")}
        onClick={() => setOpen(true)}
      >
        <PlayCircle className="size-4.5" />
        Watch 60-second demo
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="landing-demo-title"
        >
          <div className="elevated-panel max-h-[90vh] w-full max-w-5xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Walkthrough
                </p>
                <h2 id="landing-demo-title" className="mt-1 font-serif text-2xl tracking-[-0.03em] text-foreground">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close walkthrough"
                className="inline-flex size-10 items-center justify-center rounded-xl border border-border/70 bg-card/82 text-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="size-4.5" />
              </button>
            </div>

            <div className="grid gap-6 overflow-y-auto p-5 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.8fr)]">
              <Card variant="glass" className="overflow-hidden">
                <div className="border-b border-border/60 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary/70" />
                    <span className="size-2 rounded-full bg-secondary/70" />
                    <span className="size-2 rounded-full bg-accent/90" />
                  </div>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  {bullets.map((bullet, index) => (
                    <div
                      key={bullet}
                      className="rounded-[1.4rem] border border-border/70 bg-background/80 p-4 shadow-[var(--shadow-soft)]"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">{bullet}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-4">
                <Badge variant="secondary" className="w-fit">
                  What the walkthrough shows
                </Badge>
                <p className="text-sm leading-7 text-muted-foreground">{description}</p>
                <div className="space-y-3">
                  <div className="quiet-panel-muted p-4">
                    <p className="text-sm font-medium text-foreground">Start from real material</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      The flow begins with the materials families already use: chapters, PDFs, photos, outlines, weekly plans, or a plain topic.
                    </p>
                  </div>
                  <div className="quiet-panel-muted p-4">
                    <p className="text-sm font-medium text-foreground">Follow the connected workflow</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      The walkthrough stays grounded in the actual product surfaces: Curriculum, Today, Planning, Tracking, and Assistant.
                    </p>
                  </div>
                  <div className="quiet-panel-muted p-4">
                    <p className="text-sm font-medium text-foreground">End at the next teachable move</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      The point is not a brand reel. It is to show how the product gets from source material to a day you can actually teach.
                    </p>
                  </div>
                </div>
                <Link href="/auth/sign-up" className={cn(buttonVariants(), "w-full justify-center")}>
                  Create account
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function FeatureTourTabs({
  features,
}: {
  features: LandingFeature[];
}) {
  const [activeId, setActiveId] = useState(features[0]?.id ?? "");

  const activeFeature = useMemo(
    () => features.find((feature) => feature.id === activeId) ?? features[0],
    [activeId, features],
  );

  if (!activeFeature) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-2">
        {features.map((feature) => {
          const isActive = feature.id === activeFeature.id;

          return (
            <button
              key={feature.id}
              type="button"
              className={cn(
                "rounded-[1.35rem] border px-4 py-4 text-left transition-[transform,background-color,border-color,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-standard)]",
                isActive
                  ? "border-border/80 bg-card text-foreground shadow-[var(--shadow-card)]"
                  : "border-border/60 bg-card/50 text-muted-foreground hover:border-border/80 hover:bg-card/76",
              )}
              onClick={() => setActiveId(feature.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Surface
                  </p>
                  <p className="mt-1 font-serif text-xl tracking-[-0.03em]">{feature.title}</p>
                </div>
                <ChevronRight className={cn("size-4.5 transition-transform", isActive && "translate-x-0.5")} />
              </div>
            </button>
          );
        })}
      </div>

      <Card variant="glass" className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.05fr)_minmax(19rem,0.8fr)]">
          <div className="border-b border-border/60 p-5 xl:border-b-0 xl:border-r xl:p-6">
            <Badge variant="glass" className="w-fit">
              {activeFeature.headline}
            </Badge>
            <h3 className="mt-4 font-serif text-[clamp(2rem,3vw,2.8rem)] leading-[0.98] tracking-[-0.04em] text-foreground">
              {activeFeature.title} keeps the next action readable.
            </h3>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              {activeFeature.description}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {activeFeature.bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="rounded-[1.3rem] border border-border/70 bg-background/78 p-4 text-sm leading-6 text-foreground shadow-[var(--shadow-soft)]"
                >
                  {bullet}
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 xl:p-6">
            <div className={cn("rounded-[1.6rem] border border-border/70 p-4 shadow-[var(--shadow-card)]", activeFeature.accent)}>
              <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {activeFeature.title}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{activeFeature.headline}</p>
                </div>
                <div className="rounded-full border border-border/70 bg-background/74 px-3 py-1 text-xs text-muted-foreground">
                  Live surface
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {activeFeature.stats.map((stat) => (
                  <div
                    key={stat}
                    className="rounded-[1.2rem] border border-border/70 bg-background/82 px-4 py-3 text-sm text-foreground"
                  >
                    {stat}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[1.3rem] border border-dashed border-border/80 bg-background/72 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1rem] border border-border/70 bg-card/86 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Visible now</p>
                    <p className="mt-2 text-sm text-foreground">Queue, structure, and next action stay in view.</p>
                  </div>
                  <div className="rounded-[1rem] border border-border/70 bg-card/86 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Nearby context</p>
                    <p className="mt-2 text-sm text-foreground">Related planning, records, or guidance stay attached.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
