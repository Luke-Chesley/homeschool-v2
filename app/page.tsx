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
    <main className="mx-auto flex min-h-[calc(100dvh-var(--global-tabs-height))] w-full max-w-7xl flex-col px-5 py-8 sm:px-6 lg:px-8">
      <section className="border-b border-border/70 pb-6">
        <p className="text-sm text-muted-foreground">Homeschool V2</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight sm:text-5xl">
          Start with the day.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Planning, curriculum, and AI stay close to the daily workspace.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {launchItems.map(({ href, label, detail, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:bg-muted/30">
              <div className="flex h-full flex-col justify-between gap-8 p-5">
                <div className="space-y-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-muted/60 text-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl">{label}</h2>
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
