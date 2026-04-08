import { redirect } from "next/navigation";

import { HomeschoolOnboardingForm } from "@/components/onboarding/homeschool-onboarding-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppSession } from "@/lib/app-session/server";
import { getHomeschoolOnboardingStatus } from "@/lib/homeschool/onboarding/service";

export const metadata = {
  title: "Homeschool setup",
};

export default async function OnboardingPage() {
  const session = await getAppSession();
  const status = await getHomeschoolOnboardingStatus(session.organization.id);

  if (status.isComplete && session.activeLearner) {
    redirect("/today");
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Homeschool setup
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            Turn curriculum into a workable week.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Set up the household, learners, schedule, and first curriculum path in one pass. When
            setup finishes, the app generates the first week and opens today ready to use.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>V1 scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Manual curriculum entry, pasted outlines, and AI decomposition are in scope.</p>
            <p>Auth overhaul, billing, district integrations, and audio workflows are out of scope.</p>
          </CardContent>
        </Card>
      </section>

      <HomeschoolOnboardingForm
        organizationName={session.organization.name}
        defaultLearnerName={session.activeLearner?.displayName ?? null}
      />
    </main>
  );
}
