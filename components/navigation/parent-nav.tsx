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
    <nav className={cn("flex flex-col gap-2", className)} aria-label="Parent workspace">
      {parentPrimaryNav.map((item) => {
        const active = isActive(pathname, item.href, item.matchPrefix);
        const classes = cn(
          "shell-nav-item",
          active ? "shell-nav-item-active text-foreground" : "shell-nav-item-inactive text-foreground/82",
          item.disabled && "cursor-not-allowed opacity-70",
        );

        const content = (
          <>
            <div
              className={cn(
                "shell-nav-icon",
                !active && "group-hover:border-border group-hover:bg-background/82",
              )}
            >
              <item.icon className="size-[1.05rem]" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block min-w-0 text-[0.98rem] font-semibold">{item.label}</span>
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
