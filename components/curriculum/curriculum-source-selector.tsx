import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurriculumSource } from "@/lib/curriculum/types";
import { cn } from "@/lib/utils";

interface CurriculumSourceSelectorProps {
  sources: CurriculumSource[];
  selectedSourceId: string;
  basePath?: string;
  weekStartDate?: string;
}

export function CurriculumSourceSelector({
  sources,
  selectedSourceId,
  basePath = "/curriculum",
  weekStartDate,
}: CurriculumSourceSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Curriculum source</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.map((source) => {
          const selected = source.id === selectedSourceId;
          const href = weekStartDate
            ? `${basePath}?sourceId=${source.id}&weekStartDate=${weekStartDate}`
            : `${basePath}?sourceId=${source.id}`;

          return (
            <Link
              key={source.id}
              href={href}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors",
                selected ? "border-primary/40 bg-primary/10" : "border-border/70 bg-background/70 hover:bg-muted/40",
              )}
            >
              <span className="text-sm font-medium">{source.title}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.14em]">
                  v{source.importVersion}
                </Badge>
                {selected ? (
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.14em]">
                    Selected
                  </Badge>
                ) : null}
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
