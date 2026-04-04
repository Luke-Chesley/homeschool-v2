import type { ReactNode } from "react";

interface PlanningShellProps {
  children: ReactNode;
}

export function PlanningShell({ children }: PlanningShellProps) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-6 sm:px-6 lg:px-8">
      <div>{children}</div>
    </main>
  );
}
