import Link from "next/link";

import { requireAppSession } from "@/lib/app-session/server";

export const metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const session = await requireAppSession();

  return (
    <main className="page-shell page-stack">
      <header className="page-header">
        <p className="section-meta">Account</p>
        <h1 className="page-title">Household settings</h1>
        <p className="page-subtitle max-w-2xl">
          Keep the household profile, billing entry points, workspace defaults, and support details in one place.
        </p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_22rem]">
        <div className="grid gap-5">
          <section className="quiet-panel space-y-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Plan and billing</h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Billing will connect here later. For now this page acts as the stable home for plan status and household administration.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current plan</p>
                <p className="mt-1 font-medium text-foreground">Founding household workspace</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/75 p-4">
                <p className="text-sm font-medium text-foreground">Billing entry</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Subscription changes, invoices, and payment method controls will live here once billing is enabled.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/75 p-4">
                <p className="text-sm font-medium text-foreground">Workspace defaults</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Household-wide preferences and future planning defaults belong in this area.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/users"
                className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card"
              >
                Manage learners
              </Link>
              <Link
                href="/today"
                className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card"
              >
                Open workspace
              </Link>
            </div>
          </section>

          <section className="quiet-panel space-y-4 p-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Household profile</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                The current organization and learner context stay visible here.
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
          </section>

          <section className="quiet-panel space-y-4 p-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Access and support</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                This is the long-term home for household access, support, and account records.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/75 p-4">
                <p className="text-sm font-medium text-foreground">Members</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  One adult account is currently active. Additional household roles can be added here later.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/75 p-4">
                <p className="text-sm font-medium text-foreground">Support and records</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Billing history, support contact, and key account events will live alongside the household settings.
                </p>
              </div>
            </div>
          </section>
        </div>

        <aside className="grid gap-5">
          <section className="quiet-panel space-y-3 p-5">
            <p className="text-sm font-medium text-foreground">What this page covers</p>
            <div className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>Household profile and current learner context</p>
              <p>Billing and plan status entry point</p>
              <p>Future member and admin controls</p>
            </div>
          </section>

          <section className="quiet-panel space-y-3 p-5">
            <p className="text-sm font-medium text-foreground">Later additions</p>
            <div className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>Invoices and payment method controls</p>
              <p>Plan changes and entitlements</p>
              <p>Expanded household access settings</p>
              <p>Account event history</p>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
