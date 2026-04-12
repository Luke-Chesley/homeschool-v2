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
        <h1 className="page-title">Account management</h1>
        <p className="page-subtitle max-w-2xl">
          This will become the household account area for billing, plan details, seats, and admin settings.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_20rem]">
        <div className="quiet-panel space-y-5 p-6">
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Coming next</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Billing, plan changes, invoice history, and household-level preferences will live here.
              For now this page exists so the product chrome has a stable place for account work.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <p className="text-sm font-medium text-foreground">Billing</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Subscription state, invoices, and payment method management.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <p className="text-sm font-medium text-foreground">Household settings</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Names, preferences, and future workspace-level controls.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <p className="text-sm font-medium text-foreground">Members</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Household roles and access once multi-adult support is expanded.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <p className="text-sm font-medium text-foreground">Admin history</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Useful account events and future audit activity.
              </p>
            </div>
          </div>
        </div>

        <aside className="quiet-panel space-y-3 p-5">
          <p className="text-sm font-medium text-foreground">Current household</p>
          <div className="rounded-xl border border-border/60 bg-background/75 p-4">
            <p className="font-medium text-foreground">{session.organization.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Active learner: {session.activeLearner?.displayName ?? "Not selected"}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            This is a placeholder surface for Phase 5. We can build the real billing and admin flows here later.
          </p>
        </aside>
      </section>
    </main>
  );
}
