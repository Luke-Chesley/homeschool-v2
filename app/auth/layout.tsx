import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--global-tabs-height))] w-full max-w-6xl items-center px-5 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <section className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Homeschool V2
          </p>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
            Secure the workspace first.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Phase 2 replaces cookie-only session assumptions with real authenticated household access.
            Sign in, create the household workspace, then continue into onboarding.
          </p>
        </section>
        <section>{children}</section>
      </div>
    </main>
  );
}
