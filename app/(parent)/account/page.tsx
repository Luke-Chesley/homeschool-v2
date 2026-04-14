import Link from "next/link";

import { BillingOfferViewTracker } from "@/components/account/BillingOfferViewTracker";
import {
  FOUNDING_HOUSEHOLD_PLAN,
  getBillingConfiguration,
  getBillingIntervalDisplayName,
  getHouseholdBillingSummary,
} from "@/lib/billing/service";
import { ActiveLearnerSwitcher } from "@/components/users/active-learner-switcher";
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

function ActionButton({
  label,
  action,
}: {
  label: string;
  action: string;
}) {
  return (
    <form action={action} method="post">
      <button
        type="submit"
        className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card"
      >
        {label}
      </button>
    </form>
  );
}

function HiddenActionButton({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <form action="/api/billing/dev" method="post">
      <input type="hidden" name="action" value={value} />
      <button
        type="submit"
        className="inline-flex items-center rounded-lg border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-card"
      >
        {label}
      </button>
    </form>
  );
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getBillingFlashMessage(rawValue: string | string[] | undefined) {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  switch (value) {
    case "trial-started":
      return "Trial started for this household.";
    case "checkout-complete":
      return "Checkout completed. Billing state will refresh as Stripe webhooks arrive.";
    case "checkout-canceled":
      return "Checkout was canceled before billing changed.";
    case "portal-return":
      return "Billing portal closed.";
    case "sandbox-updated":
      return "Local billing sandbox updated.";
    case "not-configured":
      return "Billing is not configured in this environment yet.";
    case "checkout-error":
      return "Could not start checkout.";
    case "portal-error":
      return "Could not open billing management.";
    case "sandbox-disabled":
      return "Local billing sandbox is disabled because Stripe is configured.";
    case "sandbox-invalid":
      return "Local billing sandbox action was invalid.";
    default:
      return null;
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const emptySearchParams: Record<string, string | string[] | undefined> = {};
  const session = await requireAppSession();
  const [billingSummary, rawSearchParams] = await Promise.all([
    getHouseholdBillingSummary(session.organization.id),
    searchParams ?? Promise.resolve(emptySearchParams),
  ]);
  const billingConfig = getBillingConfiguration();
  const billingFlash = getBillingFlashMessage(rawSearchParams.billing);
  const trialEndsAtLabel = formatDateLabel(billingSummary.record.trialEndsAt);
  const currentPeriodEndLabel = formatDateLabel(billingSummary.record.currentPeriodEnd);

  return (
    <main className="page-shell page-stack">
      <BillingOfferViewTracker
        organizationId={session.organization.id}
        learnerId={session.activeLearner?.id ?? null}
        billingStatus={billingSummary.record.status}
      />
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
              <p className="mt-1 font-medium text-foreground">{billingSummary.record.planName}</p>
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

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Learner roster</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Keep one active learner at a time. Add another learner only when the household needs it.
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
                Today, Planning, Curriculum, Tracking, and Copilot follow the selected learner.
              </p>
              <div className="mt-4">
                <ActiveLearnerSwitcher
                  learners={session.learners}
                  activeLearnerId={session.activeLearner?.id ?? null}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Archived learners are not selectable in the main workspace.
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
              Keep pricing, learner limits, and billing recovery attached to the household instead of individual learners.
            </p>
          </div>

          {billingFlash ? (
            <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-foreground">
              {billingFlash}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Plan</p>
              <p className="mt-2 font-medium text-foreground">{billingSummary.record.planName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getBillingIntervalDisplayName(billingSummary.record.billingInterval)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Status</p>
              <p className="mt-2 font-medium text-foreground">{billingSummary.statusLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {trialEndsAtLabel
                  ? `Trial ends ${trialEndsAtLabel}`
                  : currentPeriodEndLabel
                    ? `Renews ${currentPeriodEndLabel}`
                    : "No billing period is active yet."}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Learner usage</p>
              <p className="mt-2 font-medium text-foreground">
                {billingSummary.activeLearnerCount} / {billingSummary.record.learnerCap} active learners
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {billingSummary.remainingLearnerSlots > 0
                  ? `${billingSummary.remainingLearnerSlots} learner slot${billingSummary.remainingLearnerSlots === 1 ? "" : "s"} left`
                  : "Learner cap reached for this household."}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/75 p-4">
            <p className="text-sm font-medium text-foreground">
              Use what you already have, get a clear day and sane week, and keep records automatically.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The launch plan is one household workspace with up to {FOUNDING_HOUSEHOLD_PLAN.learnerCap} active learners.
              Pricing stays behind the value moment instead of showing up before the parent reaches Today.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {billingSummary.canStartCheckout ? (
                <ActionButton
                  action="/api/billing/checkout"
                  label={
                    billingConfig.hasStripeConfiguration
                      ? `Start ${FOUNDING_HOUSEHOLD_PLAN.trialDays}-day trial`
                      : "Start household billing flow"
                  }
                />
              ) : null}
              {billingSummary.canManageBilling && billingConfig.hasStripeConfiguration ? (
                <ActionButton action="/api/billing/portal" label="Manage billing" />
              ) : null}
            </div>

            {billingSummary.record.status === "past_due" ? (
              <p className="mt-3 text-sm leading-6 text-foreground">
                Payment recovery should happen before adding more learners or assuming the household is fully healthy.
              </p>
            ) : null}
            {billingSummary.record.status === "canceled" ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                This household is canceled. Reactivation should restore the same household instead of creating a new one.
              </p>
            ) : null}
            {!billingConfig.hasStripeConfiguration ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Stripe is not configured in this environment. The launch-safe billing summary is live, but hosted checkout and portal sessions require Stripe env vars.
              </p>
            ) : null}
          </div>

          {billingSummary.localSandboxEnabled ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4">
              <p className="text-sm font-medium text-foreground">Local billing sandbox</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This appears only in local development when Stripe is not configured. Use it to verify trial, active, recovery, and cancellation states before wiring real hosted billing.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <HiddenActionButton label="Start trial" value="start_trial" />
                <HiddenActionButton label="Mark active" value="activate" />
                <HiddenActionButton label="Mark past due" value="past_due" />
                <HiddenActionButton label="Cancel" value="cancel" />
                <HiddenActionButton label="Reactivate" value="reactivate" />
                <HiddenActionButton label="Reset" value="reset" />
              </div>
            </div>
          ) : null}
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
