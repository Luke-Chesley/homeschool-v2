import Link from "next/link";

import { ProgramSetupCard } from "@/components/tracking/program-setup-card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ActiveLearnerSwitcher } from "@/components/users/active-learner-switcher";
import { requireAppSession } from "@/lib/app-session/server";
import { listRequirementProfiles } from "@/lib/compliance/profiles";
import { getTrackingDashboard } from "@/lib/tracking/service";

export const metadata = {
  title: "Account",
};

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card"
    >
      {label}
    </Link>
  );
}

export default async function AccountPage() {
  const session = await requireAppSession();
  const dashboard = session.activeLearner
    ? await getTrackingDashboard({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        learnerName: session.activeLearner.displayName,
      })
    : null;
  const profileOptions = listRequirementProfiles();

  return (
    <main className="page-shell page-stack">
      <header className="page-header">
        <p className="section-meta">Account</p>
        <h1 className="page-title">Household settings</h1>
      </header>

      <div className="max-w-4xl space-y-5">
        <section className="quiet-panel space-y-5 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Household profile</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Manage the household and learner context that the workspace uses.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Household</p>
              <p className="mt-2 font-medium text-foreground">{session.organization.name}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Active learner</p>
              <p className="mt-2 font-medium text-foreground">
                {session.activeLearner?.displayName ?? "Not selected"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Learner roster</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    One learner stays active at a time so Today, Planning, Curriculum, Tracking,
                    and Assistant stay focused.
                  </p>
                </div>
                <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground">
                  {session.learners.length} learner{session.learners.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 grid gap-2">
                {session.learners.map((learner) => {
                  const active = learner.id === session.activeLearner?.id;

                  return (
                    <div
                      key={learner.id}
                      className={`rounded-xl border px-4 py-3 ${
                        active
                          ? "border-primary/20 bg-primary/8"
                          : "border-border/60 bg-background/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{learner.displayName}</p>
                          <p className="mt-1 text-xs capitalize text-muted-foreground">{learner.status}</p>
                        </div>
                        {active ? (
                          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            Active
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <p className="text-sm font-medium text-foreground">Workspace context</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Use the learner switcher to keep the household focused on the right child before you
                open Today, Planning, Curriculum, Tracking, or Assistant.
              </p>
              <div className="mt-4">
                <ActiveLearnerSwitcher
                  learners={session.learners}
                  activeLearnerId={session.activeLearner?.id ?? null}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Archived learners do not appear in the main workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionLink href="/users" label="Manage learners" />
            <ActionLink href="/today" label="Open Today" />
          </div>
        </section>

        {dashboard ? (
          <ProgramSetupCard program={dashboard.program} profileOptions={profileOptions} />
        ) : null}

        <section className="quiet-panel space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Choose the workspace theme for this browser.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/75 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Switch between light and dark mode without changing household settings.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        <section className="quiet-panel space-y-3 p-6">
          <h2 className="text-lg font-semibold text-foreground">Billing</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Pricing and billing will open later. For now, focus on setting up a learner,
            opening Today, and testing the workflow.
          </p>
        </section>
      </div>
    </main>
  );
}
