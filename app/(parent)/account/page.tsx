import Link from "next/link";

import { requireAppSession } from "@/lib/app-session/server";

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

  return (
    <main className="page-shell page-stack">
      <header className="page-header">
        <p className="section-meta">Account</p>
        <h1 className="page-title">Household settings</h1>
      </header>

      <div className="max-w-4xl space-y-5">
        <section className="quiet-panel space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Household profile</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Keep the current household, learner context, and default workspace settings in one place.
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current plan</p>
              <p className="mt-1 font-medium text-foreground">Founding household workspace</p>
            </div>
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
            <div className="rounded-xl border border-border/60 bg-background/75 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Workspace defaults</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Household-wide planning defaults and preferences will live here as those controls are added.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionLink href="/users" label="Manage learners" />
            <ActionLink href="/today" label="Open workspace" />
          </div>
        </section>

        <section className="quiet-panel space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Billing</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Billing is not live yet. This section reserves the future home for plan changes, invoices, and payment methods.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4">
            <p className="text-sm font-medium text-foreground">Billing controls arrive in a later phase.</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              When billing is enabled, this section will hold subscription status, invoices, and payment method management.
            </p>
          </div>
        </section>

        <section className="quiet-panel space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Access and support</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Household access, support records, and account history will expand here over time.
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
                Key account events, support notes, and household records will live here as the account surface fills out.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
