import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Home, LogOut } from "lucide-react";

import { StudioToggle } from "@/components/studio/StudioToggle";
import { Button } from "@/components/ui/button";
import { getAppSession } from "@/lib/app-session/server";

export const metadata = {
  title: {
    template: "%s — Learner",
    default: "Learner",
  },
};

export default async function LearnerLayout({ children }: { children: ReactNode }) {
  const session = await getAppSession();

  if (!session.activeLearner) {
    redirect("/users");
  }

  return (
    <div className="learner-shell">
      <header className="learner-topbar">
        <div className="learner-topbar-inner">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/learner" className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
              <BookOpen className="size-4 text-primary" />
              Learner
            </Link>
            <div className="hidden h-4 w-px bg-border/80 sm:block" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {session.activeLearner.displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {session.platformSettings.learnerLabel} workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/learner"
              className="hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              <Home className="size-4" />
              Queue
            </Link>
            <StudioToggle />
            <Link
              href="/today"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Workspace
            </Link>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm" className="gap-2">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="learner-page">{children}</div>
      </main>
    </div>
  );
}
