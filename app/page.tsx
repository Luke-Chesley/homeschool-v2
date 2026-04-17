import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { getAppAuthState } from "@/lib/app-session/server";

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
    <main className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <section className="grid gap-10 border-b border-border/70 pb-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)] lg:items-start">
        <div className="max-w-4xl space-y-5">
          <h1 className="font-serif text-[clamp(2.55rem,5.4vw,4.7rem)] leading-[0.98] tracking-[-0.035em] text-foreground">
            Turn what you already have into a teachable homeschool day.
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Paste a chapter, upload a plan, or snap a photo. Build today first, keep the week nearby,
            and record what actually happened.
          </p>
        </div>

        <div className="max-w-xl space-y-5 pt-1 lg:pt-2">
          <p className="text-base leading-7 text-muted-foreground">
            One calm workspace for the clear day, the sane week, and the records that follow real work.
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

      <section className="grid gap-6 py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-start">
        <div className="grid gap-4">
          <div className="space-y-2 pb-1">
            <p className="section-meta">How it works</p>
            <h2 className="font-serif text-3xl tracking-tight text-foreground">From what you have to what you can teach next.</h2>
          </div>
          {proofSteps.map((point, index) => (
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
          <p className="text-sm font-medium text-foreground">What stays close</p>
          <div className="space-y-3">
            {supportingPoints.map((point) => (
              <div
                key={point.title}
                className="rounded-lg border border-border/70 bg-background/80 px-4 py-3"
              >
                <p className="text-sm font-medium text-foreground">{point.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{point.body}</p>
              </div>
            ))}
          </div>

          <Link
            href="/auth/sign-up"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            Start with one household and one learner
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
