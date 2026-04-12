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
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link href="/learner" className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
              <BookOpen className="size-4 text-primary" />
              <span className="hidden sm:inline">Learner</span>
            </Link>
            <div className="hidden h-4 w-px bg-border/80 sm:block" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {session.activeLearner.displayName}
              </p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {session.platformSettings.learnerLabel} workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/learner"
              className="hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              <Home className="size-4" />
              Queue
            </Link>
            <StudioToggle compact />
            <Link
              href="/today"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
              aria-label="Back to workspace"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Workspace</span>
            </Link>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm" className="gap-2 px-2.5 sm:px-3" aria-label="Sign out">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
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
