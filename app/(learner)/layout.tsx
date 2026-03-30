/**
 * Learner-safe layout.
 *
 * Intentionally minimal — no parent navigation, admin controls, or
 * curriculum management links. Keeps the learner's environment distraction-
 * free and clearly separated from the parent workspace.
 */

import { ReactNode } from "react";
import { BookOpen } from "lucide-react";

export const metadata = {
  title: {
    template: "%s — Learner",
    default: "Learner",
  },
};

export default function LearnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal learner header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <BookOpen className="size-5 text-primary" />
          <span className="font-serif text-base font-semibold">My Learning</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-8 px-4">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
