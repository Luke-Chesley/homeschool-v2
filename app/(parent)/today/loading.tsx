import { PlanningShell } from "@/components/planning/planning-shell";

export default function TodayLoading() {
  return (
    <PlanningShell>
      <header className="page-header">
        <div className="h-4 w-28 rounded-full bg-muted/80" />
        <div className="h-10 w-32 rounded-3xl bg-muted/80" />
        <div className="flex flex-wrap gap-2">
          <div className="h-4 w-16 rounded-full bg-muted/70" />
          <div className="h-4 w-20 rounded-full bg-muted/70" />
        </div>
      </header>

      <section className="quiet-panel p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded-full bg-muted/80" />
            <div className="h-8 w-72 rounded-3xl bg-muted/80" />
            <div className="h-4 w-full max-w-xl rounded-full bg-muted/70" />
          </div>
          <div className="grid w-full gap-2 sm:w-auto">
            <div className="h-11 w-full rounded-lg bg-muted/80 sm:w-40" />
            <div className="h-11 w-full rounded-lg bg-muted/70 sm:w-32" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)] xl:items-start">
        <section className="space-y-3">
          <div className="quiet-panel h-40" />
          <div className="quiet-panel h-40" />
        </section>
        <section className="quiet-panel h-[28rem]" />
      </div>
    </PlanningShell>
  );
}
