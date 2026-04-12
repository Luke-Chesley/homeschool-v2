import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--global-tabs-height))] w-full max-w-6xl items-center px-5 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
        <section className="space-y-5">
          <p className="text-sm text-muted-foreground">Homeschool V2</p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
            Get the household workspace ready.
          </h1>
          <p className="max-w-2xl text-base leading-8 text-muted-foreground">
            Sign in or create the adult account first. Setup continues directly into household and learner
            configuration so the app can open with a workable day instead of an empty shell.
          </p>
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            <div className="quiet-panel-muted p-4">
              <p className="text-sm font-medium text-foreground">Sign in</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Open the existing household workspace.</p>
            </div>
            <div className="quiet-panel-muted p-4">
              <p className="text-sm font-medium text-foreground">Set up</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Create learners, defaults, and curriculum.</p>
            </div>
            <div className="quiet-panel-muted p-4">
              <p className="text-sm font-medium text-foreground">Run today</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Land in the daily workspace ready to use.</p>
            </div>
          </div>
        </section>
        <section>{children}</section>
      </div>
    </main>
  );
}
