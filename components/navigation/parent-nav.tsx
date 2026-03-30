"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
    <nav className={cn("flex flex-col gap-2", className)} aria-label="Parent workspace">
      {parentPrimaryNav.map((item) => {
        const active = isActive(pathname, item.href, item.matchPrefix);
        const classes = cn(
          "group flex items-start gap-3 rounded-[1.35rem] border px-4 py-3 text-left transition-colors",
          active
            ? "border-primary/25 bg-primary/10 text-foreground shadow-[0_16px_40px_-28px_rgba(176,93,45,0.6)]"
            : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-card/70 hover:text-foreground",
          item.disabled && "cursor-not-allowed opacity-70",
        );

        const content = (
          <>
            <div
              className={cn(
                "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground group-hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{item.label}</span>
                {item.disabled ? (
                  <Badge variant="outline" className="h-6 rounded-full px-2 text-[10px]">
                    Soon
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
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
