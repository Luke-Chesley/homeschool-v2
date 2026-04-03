import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { CurriculumSource } from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";

interface CurriculumSourceSelectorProps {
  sources: CurriculumSource[];
  selectedSourceId: string;
  basePath?: string;
  weekStartDate?: string;
  month?: string;
}

export function CurriculumSourceSelector({
  sources,
  selectedSourceId,
  basePath = "/curriculum",
  weekStartDate,
  month,
}: CurriculumSourceSelectorProps) {
  return (
    <Card>
      <div className="space-y-2 p-4">
        <p className="text-sm font-medium text-foreground">Sources</p>
        {sources.map((source) => {
          const selected = source.id === selectedSourceId;
          const params = new URLSearchParams({ sourceId: source.id });
          if (weekStartDate) {
            params.set("weekStartDate", weekStartDate);
          }
          if (month) {
            params.set("month", month);
          }
          const href = `${basePath}?${params.toString()}`;

          return (
            <Link
              key={source.id}
              href={href}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                selected
                  ? "border-primary/25 bg-primary/8"
                  : "border-border/70 bg-background hover:bg-muted/40",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{source.title}</p>
                <p className="text-xs text-muted-foreground">
                  {source.kind.replace("_", " ")} · v{source.importVersion}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{selected ? "Current" : "Open"}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
