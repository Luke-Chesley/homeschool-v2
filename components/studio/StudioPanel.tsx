import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StudioPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]", className)}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
