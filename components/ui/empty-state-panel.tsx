import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmptyStatePanel({
  title,
  body,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  body: string;
  icon?: LucideIcon;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card variant="glass" className={cn("empty-state-panel text-left", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {Icon ? (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/76 text-muted-foreground shadow-[var(--shadow-soft)]">
            <Icon className="size-5" />
          </div>
        ) : null}
        <div className="space-y-2">
          <h2 className="font-serif text-2xl leading-tight tracking-[-0.03em] text-foreground">
            {title}
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{body}</p>
          {children ? <div className="pt-2">{children}</div> : null}
        </div>
      </div>
    </Card>
  );
}
