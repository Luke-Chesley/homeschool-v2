import { redirect } from "next/navigation";

import { HomeschoolOnboardingForm } from "@/components/onboarding/homeschool-onboarding-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppSession } from "@/lib/app-session/server";
import { getHomeschoolOnboardingStatus } from "@/lib/homeschool/onboarding/service";

export const metadata = {
  title: "Fast onboarding",
};

export default async function OnboardingPage() {
  const session = await getAppSession();
  const status = await getHomeschoolOnboardingStatus(session.organization.id);

  if (status.isComplete && session.activeLearner) {
    redirect("/today");
  }

  return (
    <main className="page-shell page-stack">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-3">
          <p className="section-meta">Fast onboarding</p>
          <h1 className="page-title">Reach Today first.</h1>
          <p className="page-subtitle">
            Add one learner and paste or upload anything you have. Build a teachable day now, then refine household defaults later.
          </p>
        </div>

        <Card className="quiet-panel">
          <CardHeader>
            <CardTitle>Setup flow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Add one learner name.</p>
            <p>Paste text or upload one source.</p>
            <p>Generate and open Today.</p>
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
