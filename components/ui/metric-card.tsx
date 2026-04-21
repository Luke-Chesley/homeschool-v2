import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
  tone?: "default" | "accent" | "secondary";
}) {
  return (
    <Card
      variant="glass"
      className={cn(
        "metric-card overflow-hidden",
        tone === "accent" && "border-primary/20",
        tone === "secondary" && "border-secondary/20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="font-serif text-[1.85rem] leading-none tracking-[-0.03em] text-foreground">
            {value}
          </p>
        </div>
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/78 text-muted-foreground">
            <Icon className="size-4.5" />
          </div>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
