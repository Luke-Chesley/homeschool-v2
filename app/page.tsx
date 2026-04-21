import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, CalendarRange, CheckCircle2, NotebookPen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { buttonVariants } from "@/components/ui/button";
import { getAppAuthState } from "@/lib/app-session/server";
import { cn } from "@/lib/utils";

const proofSteps = [
  {
    title: "Bring what you already have",
    body: "Start with a chapter, outline, weekly plan, photo, PDF, or topic instead of rebuilding everything from scratch.",
  },
  {
    title: "Open a clear day",
    body: "Build today first, with a lesson and activity that are ready to teach without digging through tabs.",
  },
  {
    title: "Keep the week and records nearby",
    body: "Adjust the sane week when life changes and keep records of what actually happened in one place.",
  },
] as const;

const supportingPoints = [
  {
    title: "Start from today",
    body: "Reach the teachable day first instead of getting pulled into setup screens and admin work.",
  },
  {
    title: "Adjust the week nearby",
    body: "Planning stays close enough to shift when a lesson runs long, a day gets missed, or a learner needs a lighter option.",
  },
  {
    title: "Keep records without extra bookkeeping",
    body: "Tracking stays tied to real work so progress, notes, and evidence do not have to be rebuilt later.",
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 pb-12 pt-8 sm:px-6 lg:px-8 lg:gap-14 lg:pt-12">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(23rem,0.9fr)] lg:items-start">
        <div className="space-y-6">
          <Badge variant="glass" className="w-fit">Homeschool workspace</Badge>
          <div className="space-y-4">
            <h1 className="font-serif text-[clamp(2.8rem,5.8vw,5.35rem)] leading-[0.94] tracking-[-0.045em] text-foreground">
              Turn what you already have into a teachable homeschool day.
            </h1>
            <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
              Paste a chapter, upload a plan, or snap a photo. Build today first, keep the week nearby,
              and record what actually happened in one calm workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/auth/sign-up" className={buttonVariants({ size: "lg" })}>
              Create account
            </Link>
            <Link href="/auth/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Sign in
            </Link>
          </div>

          <div className="metric-grid">
            <MetricCard label="Start from today" value="1 clear day" hint="Open the next teachable day instead of rebuilding everything from scratch." icon={BookOpen} />
            <MetricCard label="Keep the week nearby" value="1 sane week" hint="Shift the plan when life changes without losing the overall route." icon={CalendarRange} tone="secondary" />
            <MetricCard label="Record what happened" value="1 living record" hint="Tracking stays tied to real work so reports do not become a second project." icon={NotebookPen} />
          </div>
        </div>

        <div className="glass-panel space-y-5 overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-meta">What the workspace does</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-foreground">Clear day. Sane week. Solid record.</h2>
            </div>
            <div className="hidden rounded-2xl border border-border/70 bg-background/75 p-3 text-muted-foreground shadow-[var(--shadow-soft)] sm:block">
              <CheckCircle2 className="size-5" />
            </div>
          </div>

          <div className="space-y-3">
            {supportingPoints.map((point) => (
              <div key={point.title} className="rounded-[1.35rem] border border-border/70 bg-background/72 px-4 py-4 shadow-[var(--shadow-soft)]">
                <p className="text-sm font-medium text-foreground">{point.title}</p>
                <p className="mt-1 text-sm leading-7 text-muted-foreground">{point.body}</p>
              </div>
            ))}
          </div>

          <Link
            href="/auth/sign-up"
            className={cn(buttonVariants({ variant: "subtle" }), "w-full justify-between rounded-2xl")}
          >
            Start with one household and one learner
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-start">
        <div className="grid gap-4">
          <div className="space-y-2 pb-1">
            <p className="section-meta">How it works</p>
            <h2 className="font-serif text-3xl tracking-tight text-foreground">From what you have to what you can teach next.</h2>
          </div>
          {proofSteps.map((point, index) => (
            <div key={point.title} className="glass-panel px-5 py-5">
              <div className="grid gap-2 md:grid-cols-[2.5rem_minmax(0,1fr)] md:items-start">
                <span className="text-sm text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <div className="space-y-1.5">
                  <h2 className="font-serif text-[1.6rem] leading-tight tracking-tight text-foreground">
                    {point.title}
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{point.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="context-rail">
          <p className="section-meta">What the first pass looks like</p>
          <div className="space-y-3">
            <div className="rounded-[1.35rem] border border-border/70 bg-background/74 p-4">
              <p className="font-medium text-foreground">Import or paste what already exists</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">A chapter outline, weekly plan, worksheet photo, or copied text is enough to start.</p>
            </div>
            <div className="rounded-[1.35rem] border border-border/70 bg-background/74 p-4">
              <p className="font-medium text-foreground">Open Today first</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">The workspace surfaces the next lesson, the queue, and the actions that matter right now.</p>
            </div>
            <div className="rounded-[1.35rem] border border-border/70 bg-background/74 p-4">
              <p className="font-medium text-foreground">Keep planning and records close</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">Adjust the week without losing continuity, then turn real work into usable records and evidence.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
