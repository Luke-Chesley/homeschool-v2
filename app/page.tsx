import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { getAppAuthState } from "@/lib/app-session/server";

const capabilityLabels = [
  "Daily workspace",
  "Weekly planning",
  "Curriculum structure",
  "Learner tracking",
  "Context-aware Copilot",
] as const;

const productPoints = [
  {
    title: "Start from the day",
    body: "The product is built around a workable daily queue instead of making you navigate an admin dashboard before teaching starts.",
  },
  {
    title: "Keep planning nearby",
    body: "Weekly planning and curriculum stay close enough to adjust when reality changes, without taking over the whole experience.",
  },
  {
    title: "Use AI quietly",
    body: "Copilot is available when you need the next move, but it stays embedded in the workflow instead of becoming the product itself.",
  },
] as const;

export default async function HomePage() {
  const state = await getAppAuthState();

  if (state.status === "ready") {
    redirect("/today");
  }

  if (state.status === "needs_setup") {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <section className="grid gap-10 border-b border-border/70 pb-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)] lg:items-start">
        <div className="max-w-3xl">
          <h1 className="font-serif text-[clamp(2.55rem,5.4vw,4.7rem)] leading-[0.98] tracking-[-0.035em] text-foreground">
            Homeschool planning built around the real teaching day.
          </h1>
        </div>

        <div className="max-w-xl space-y-5 pt-1 lg:pt-2">
          <p className="text-base leading-7 text-muted-foreground">
            One calm workspace for today&apos;s queue, weekly adjustments, curriculum structure, learner
            context, and AI help that stays useful instead of loud.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/auth/sign-up"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-95"
            >
              Create account
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-border/70 py-6 text-sm text-muted-foreground">
        <span className="text-foreground/70">Made for:</span>
        {capabilityLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </section>

      <section className="grid gap-6 py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-start">
        <div className="grid gap-4">
          {productPoints.map((point, index) => (
            <div key={point.title} className="quiet-panel px-5 py-5">
              <div className="grid gap-2 md:grid-cols-[2rem_minmax(0,1fr)] md:items-start">
                <span className="text-sm text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <div className="space-y-1.5">
                  <h2 className="font-serif text-[1.55rem] leading-tight tracking-tight text-foreground">
                    {point.title}
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{point.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="quiet-panel space-y-4 p-5">
          <p className="text-sm font-medium text-foreground">Inside the workspace</p>
          <div className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/80 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Today</p>
              <p className="mt-1 text-sm text-muted-foreground">Queue what matters and keep the lesson flow readable.</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/80 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Planning</p>
              <p className="mt-1 text-sm text-muted-foreground">Adjust the week without rebuilding everything from scratch.</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/80 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Copilot</p>
              <p className="mt-1 text-sm text-muted-foreground">Ask for the next move with learner and week context attached.</p>
            </div>
          </div>

          <Link
            href="/auth/sign-up"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            Start with a household account
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
