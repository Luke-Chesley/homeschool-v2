import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Bot, CalendarDays, PlaySquare } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getAppSession } from "@/lib/app-session/server";
import { getHomeschoolOnboardingStatus } from "@/lib/homeschool/onboarding/service";

const launchItems = [
  {
    href: "/today",
    label: "Open today",
    detail: "Run the day",
    icon: PlaySquare,
  },
  {
    href: "/planning",
    label: "Planning",
    detail: "Shape the week",
    icon: CalendarDays,
  },
  {
    href: "/curriculum",
    label: "Curriculum",
    detail: "Browse the source",
    icon: BookOpen,
  },
  {
    href: "/copilot",
    label: "Copilot",
    detail: "Ask for help",
    icon: Bot,
  },
];

export default async function HomePage() {
  const session = await getAppSession();
  const onboarding = await getHomeschoolOnboardingStatus(session.organization.id);

  if (!onboarding.isComplete) {
    redirect("/onboarding");
  }

  return (
    <main className="page-shell page-stack">
      <header className="page-header">
        <p className="section-meta">Workspace</p>
        <h1 className="page-title">Start with the day.</h1>
        <p className="page-subtitle max-w-2xl">
          Open the daily workspace, adjust the week, browse curriculum, or ask Copilot for the next move.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {launchItems.map(({ href, label, detail, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="quiet-panel h-full transition-colors hover:bg-muted/30">
              <div className="flex h-full flex-col justify-between gap-8 p-5">
                <div className="space-y-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-muted/60 text-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <h2 className="font-serif text-[1.9rem] tracking-tight">{label}</h2>
                    <p className="text-sm text-muted-foreground">{detail}</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  Open
                  <ArrowRight className="size-4" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}
