import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

const authHighlights = [
  {
    title: "One household account",
    body: "Start with the adult account, then add learners and planning defaults after sign-in.",
  },
  {
    title: "Today first",
    body: "Open the daily workspace with clear next steps after setup.",
  },
  {
    title: "Planning and tracking stay connected",
    body: "The week, the day, and the record all stay close enough to support real teaching.",
  },
] as const;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="native-shell-page mx-auto flex min-h-[calc(100dvh-var(--global-tabs-height))] w-full max-w-7xl items-center px-5 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,460px)] lg:items-center">
        <section className="space-y-6">
          <Badge variant="glass" className="w-fit">Homeschool V2</Badge>
          <div className="space-y-3">
            <h1 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.96] tracking-[-0.04em]">
              Sign in and open the homeschool workspace.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground">
              Sign in, finish the household setup, and go straight to planning, teaching, and tracking.
            </p>
          </div>

          <div className="grid max-w-3xl gap-3 md:grid-cols-3">
            {authHighlights.map((highlight) => (
              <div key={highlight.title} className="glass-panel p-4">
                <p className="text-sm font-medium text-foreground">{highlight.title}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{highlight.body}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="lg:pl-4">{children}</section>
      </div>
    </main>
  );
}
