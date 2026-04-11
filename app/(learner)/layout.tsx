import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, LogOut } from "lucide-react";

import { StudioProvider } from "@/components/studio/studio-provider";
import { StudioToggle } from "@/components/studio/StudioToggle";
import { Button } from "@/components/ui/button";
import { getAppSession } from "@/lib/app-session/server";
import { getStudioAccess } from "@/lib/studio/access";

export const metadata = {
  title: {
    template: "%s — Learner",
    default: "Learner",
  },
};

export default async function LearnerLayout({ children }: { children: ReactNode }) {
  const session = await getAppSession();
  const studioAccess = getStudioAccess();

  if (!session.activeLearner) {
    redirect("/users");
  }

  return (
    <StudioProvider access={studioAccess}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/70 bg-background/96">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <BookOpen className="size-4 shrink-0 text-primary" />
              <span className="truncate font-serif text-lg">
                {session.platformSettings.learnerLabel}: {session.activeLearner.displayName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StudioToggle />
              <Link
                href="/today"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                {session.platformSettings.primaryGuideLabel}
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

        <main className="flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </StudioProvider>
  );
}
