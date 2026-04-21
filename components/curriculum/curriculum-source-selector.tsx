import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CurriculumSource } from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";

interface CurriculumSourceSelectorProps {
  sources: CurriculumSource[];
  activeSourceId: string;
  onActivateSource: (formData: FormData) => Promise<void>;
}

export function CurriculumSourceSelector({
  sources,
  activeSourceId,
  onActivateSource,
}: CurriculumSourceSelectorProps) {
  return (
    <Card variant="glass" className="min-w-0 border-border/60">
      <div className="min-w-0 space-y-4 p-4">
        <div className="space-y-1">
          <p className="section-meta">Source list</p>
          <p className="text-sm text-muted-foreground">
            Planning, today, and tracking all read from the source marked live here.
          </p>
        </div>
        {sources.map((source) => {
          const selected = source.id === activeSourceId;

          return (
            <div
              key={source.id}
              className={cn(
                "flex w-full min-w-0 items-start justify-between gap-3 rounded-[calc(var(--radius)-0.05rem)] border px-3 py-3.5 transition-[transform,box-shadow,border-color,background-color] duration-[var(--motion-base)] ease-[var(--ease-standard)] hover:-translate-y-px hover:shadow-[var(--shadow-soft)]",
                selected
                  ? "border-primary/25 bg-primary/8 shadow-[var(--shadow-soft)]"
                  : "border-border/60 bg-background/80",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{source.title}</p>
                  {selected ? (
                    <span className="rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                      Live
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {source.kind.replace("_", " ")} · v{source.importVersion}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/curriculum/${source.id}`}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    "border-border/70 bg-background text-foreground hover:bg-muted/40",
                  )}
                >
                  Open
                </Link>
                <form action={onActivateSource}>
                  <input type="hidden" name="sourceId" value={source.id} />
                  <Button
                    type="submit"
                    size="sm"
                    variant={selected ? "secondary" : "outline"}
                    disabled={selected}
                    className="h-8"
                  >
                    {selected ? "Live" : "Set live"}
                  </Button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
