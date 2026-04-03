import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";

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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background/96">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <span className="font-serif text-lg">
              {session.platformSettings.learnerLabel}: {session.activeLearner.displayName}
            </span>
          </div>
          <Link
            href="/today"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {session.platformSettings.primaryGuideLabel}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
