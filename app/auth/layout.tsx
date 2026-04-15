import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="native-shell-page mx-auto flex min-h-[calc(100dvh-var(--global-tabs-height))] w-full max-w-6xl items-center px-5 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
        <section className="space-y-6">
          <div className="space-y-3">
            <p className="section-meta">Homeschool V2</p>
            <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-[3.2rem]">
              Open the household workspace without the setup friction.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground">
              Sign in, finish the household setup, and land in a workspace that is ready to plan and run.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            <div className="quiet-panel-muted p-4">
              <p className="text-sm font-medium text-foreground">Account</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Start with the adult household account.</p>
            </div>
            <div className="quiet-panel-muted p-4">
              <p className="text-sm font-medium text-foreground">Household</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Create the learner and planning defaults.</p>
            </div>
            <div className="quiet-panel-muted p-4">
              <p className="text-sm font-medium text-foreground">Today</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Land in the daily workspace ready to use.</p>
            </div>
          </div>
        </section>
        <section>{children}</section>
      </div>
    </main>
  );
}
