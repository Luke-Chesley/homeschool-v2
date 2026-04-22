import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  icon: _icon,
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 max-w-[11ch] text-balance font-serif text-[clamp(1.9rem,2.5vw,2.6rem)] leading-[0.96] tracking-[-0.04em] text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-4 max-w-[24ch] text-sm leading-7 text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
