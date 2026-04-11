import type { ReactNode } from "react";

export function StudioTraceMeta({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="rounded-full border border-border/70 bg-muted/25 px-2 py-1">
          <span className="font-medium text-foreground">{item.label}:</span> {item.value}
        </span>
      ))}
    </div>
  );
}
