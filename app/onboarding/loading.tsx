export default function OnboardingLoading() {
  return (
    <main className="page-shell page-stack">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-3">
          <div className="h-4 w-28 rounded-full bg-muted/80" />
          <div className="h-10 w-3/4 rounded-3xl bg-muted/80" />
          <div className="h-4 w-full max-w-2xl rounded-full bg-muted/70" />
          <div className="h-4 w-2/3 max-w-xl rounded-full bg-muted/70" />
        </div>
        <section className="quiet-panel space-y-3 p-6">
          <div className="h-5 w-28 rounded-full bg-muted/80" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded-full bg-muted/70" />
            <div className="h-4 w-5/6 rounded-full bg-muted/70" />
            <div className="h-4 w-2/3 rounded-full bg-muted/70" />
          </div>
        </section>
      </section>

      <section className="quiet-panel space-y-4 p-6">
        <div className="h-5 w-40 rounded-full bg-muted/80" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-h-24 rounded-xl border border-border/60 bg-background/75" />
          <div className="min-h-24 rounded-xl border border-border/60 bg-background/75" />
          <div className="min-h-24 rounded-xl border border-border/60 bg-background/75" />
          <div className="min-h-24 rounded-xl border border-border/60 bg-background/75" />
        </div>
        <div className="min-h-40 rounded-xl border border-border/60 bg-background/75" />
      </section>
    </main>
  );
}
