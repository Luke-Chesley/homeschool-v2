import { Loader2 } from "lucide-react";

export default function ActivityLoading() {
  return (
    <div className="learner-reading-surface">
      <div className="learner-reading-column space-y-4 py-2">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded-full bg-muted/80" />
          <div className="h-10 w-3/4 rounded-3xl bg-muted/80" />
          <div className="h-4 w-full rounded-full bg-muted/70" />
          <div className="h-4 w-2/3 rounded-full bg-muted/70" />
        </div>
        <div className="rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Loading activity…</p>
              <p className="text-sm text-muted-foreground">
                Restoring the learner session and preparing the next step.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-28 rounded-xl border border-border/70 bg-background/75" />
          <div className="h-32 rounded-xl border border-border/70 bg-background/75" />
        </div>
      </div>
    </div>
  );
}
