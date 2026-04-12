import Link from "next/link";
import { FileSpreadsheet, ListChecks } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TrackingShellProps {
  currentView: "overview" | "reports";
  title: string;
  description: string;
  children: ReactNode;
}

const navItems = [
  {
    href: "/tracking",
    label: "Overview",
    view: "overview" as const,
    icon: ListChecks,
  },
  {
    href: "/tracking/reports",
    label: "Reports",
    view: "reports" as const,
    icon: FileSpreadsheet,
  },
];

export function TrackingShell({
  currentView,
  title,
  description,
  children,
}: TrackingShellProps) {
  return (
    <main className="page-shell min-h-full pb-16">
      <header className="page-header">
        <p className="section-meta">Tracking</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle max-w-3xl">{description}</p>
        <div className="toolbar-row gap-4 pt-1">
          {navItems.map(({ href, label, view, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-sm transition-colors",
                currentView === view
                  ? "border-border bg-card text-foreground"
                  : "text-muted-foreground hover:border-border/70 hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </div>
      </header>

      <div>{children}</div>
    </main>
  );
}
