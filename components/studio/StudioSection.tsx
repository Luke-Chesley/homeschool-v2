import type { ReactNode } from "react";

export function StudioSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      {children}
    </section>
  );
}
