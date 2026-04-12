import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Bot, CalendarDays, PlaySquare } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getAppAuthState } from "@/lib/app-session/server";

const launchItems = [
  {
    href: "/today",
    label: "Daily workspace",
    detail: "Run the day with a clear queue and lesson flow.",
    icon: PlaySquare,
  },
  {
    href: "/planning",
    label: "Planning",
    detail: "Shape the week without drowning in controls.",
    icon: CalendarDays,
  },
  {
    href: "/curriculum",
    label: "Curriculum",
    detail: "Keep the live source visible and easy to revise.",
    icon: BookOpen,
  },
  {
    href: "/copilot",
    label: "Copilot",
    detail: "Ask for the next move with the current context attached.",
    icon: Bot,
  },
];

export default async function HomePage() {
  const state = await getAppAuthState();

  if (state.status === "ready") {
    redirect("/today");
  }

  if (state.status === "needs_setup") {
    redirect("/onboarding");
  }

  return (
    <main className="page-shell page-stack">
      <header className="page-header">
        <p className="section-meta">Homeschool V2</p>
        <h1 className="page-title max-w-3xl">Calm planning, curriculum, and teaching support in one workspace.</h1>
        <p className="page-subtitle max-w-2xl">
          Built for households that need a usable daily workspace first, with planning, curriculum,
          tracking, and AI support close by instead of scattered across separate tools.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href="/auth/sign-up"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-95"
          >
            Create account
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="grid gap-4 md:grid-cols-2">
          {launchItems.map(({ href, label, detail, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="quiet-panel h-full transition-colors hover:bg-muted/30">
                <div className="flex h-full flex-col justify-between gap-8 p-5">
                  <div className="space-y-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-muted/60 text-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <h2 className="font-serif text-[1.9rem] tracking-tight">{label}</h2>
                      <p className="text-sm text-muted-foreground">{detail}</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    Open
                    <ArrowRight className="size-4" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <aside className="quiet-panel space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">What this product is for</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Homeschool V2 is designed around the daily teaching workflow, then extends outward into
              weekly planning, curriculum structure, tracking, and contextual AI help.
            </p>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Start with the current day.</p>
            <p>Adjust the week when reality changes.</p>
            <p>Keep curriculum and lesson work close to execution.</p>
            <p>Use Copilot when you need the next move, not a separate AI product.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
