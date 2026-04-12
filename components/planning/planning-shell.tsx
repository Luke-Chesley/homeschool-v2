import type { ReactNode } from "react";

interface PlanningShellProps {
  children: ReactNode;
}

export function PlanningShell({ children }: PlanningShellProps) {
  return (
    <main className="page-shell min-h-full">
      <div className="page-stack">{children}</div>
    </main>
  );
}
