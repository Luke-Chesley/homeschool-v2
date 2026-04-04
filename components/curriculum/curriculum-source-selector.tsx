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
    <Card className="min-w-0">
      <div className="min-w-0 space-y-3 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Live curriculum</p>
          <p className="text-xs text-muted-foreground">
            Planning, today, and tracking all read from the source marked live here.
          </p>
        </div>
        {sources.map((source) => {
          const selected = source.id === activeSourceId;

          return (
            <div
              key={source.id}
              className={cn(
                "flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                selected
                  ? "border-primary/25 bg-primary/8"
                  : "border-border/70 bg-background",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{source.title}</p>
                <p className="text-xs text-muted-foreground">
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
