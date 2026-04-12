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
        <p className="section-meta">Tracking and reporting</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{description}</p>
        <div className="toolbar-row gap-5 border-t border-border/60 pt-3">
          {navItems.map(({ href, label, view, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 border-b border-transparent pb-1 text-sm transition-colors",
                currentView === view
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground hover:border-border hover:text-foreground",
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
