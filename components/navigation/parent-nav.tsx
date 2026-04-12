"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { parentPrimaryNav } from "@/components/navigation/parent-nav-config";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string, matchPrefix: string) {
  if (pathname === href) {
    return true;
  }

  return matchPrefix !== "/" && pathname.startsWith(`${matchPrefix}/`);
}

type ParentNavProps = {
  className?: string;
  onNavigate?: () => void;
};

export function ParentNav({ className, onNavigate }: ParentNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Parent workspace">
      {parentPrimaryNav.map((item) => {
        const active = isActive(pathname, item.href, item.matchPrefix);
        const classes = cn(
          "group flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
          active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          item.disabled && "cursor-not-allowed opacity-70",
        );

        const content = (
          <>
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "bg-muted/70 text-muted-foreground group-hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
            </div>
          </>
        );

        if (item.disabled) {
          return (
            <div key={item.label} className={classes} aria-disabled="true">
              {content}
            </div>
          );
        }

        return (
          <Link key={item.href} href={item.href} className={classes} onClick={onNavigate}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
