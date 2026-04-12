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
          <h1 className="font-serif text-[clamp(3.1rem,7vw,5.8rem)] leading-[0.96] tracking-[-0.045em] text-foreground">
            Homeschool planning built around the real teaching day.
          </h1>
        </div>

        <div className="max-w-xl space-y-6 pt-1 lg:pt-3">
          <p className="text-[1.05rem] leading-8 text-muted-foreground">
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

      <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:items-start">
        <div className="quiet-panel overflow-hidden">
          <div className="border-b border-border/70 px-6 py-4">
            <p className="text-sm font-medium text-foreground">What the product tries to protect</p>
          </div>
          <div className="space-y-10 px-6 py-6">
            {productPoints.map((point, index) => (
              <div key={point.title} className="grid gap-3 md:grid-cols-[2.5rem_minmax(0,1fr)] md:items-start">
                <span className="text-sm text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <div className="space-y-2">
                  <h2 className="font-serif text-[1.9rem] leading-tight tracking-tight text-foreground">
                    {point.title}
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{point.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border/80 bg-card/88 p-6 shadow-[var(--shadow-card)]">
            <p className="text-sm font-medium text-foreground">Inside the workspace</p>
            <div className="mt-5 space-y-4">
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
                <p className="mt-1 text-sm text-muted-foreground">Ask for the next move with current learner and week context attached.</p>
              </div>
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
