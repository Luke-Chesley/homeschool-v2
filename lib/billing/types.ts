import { z } from "zod";

export const BILLING_STATUSES = [
  "none",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
] as const;

export const BILLING_INTERVALS = ["annual", "monthly"] as const;

export const LOCAL_BILLING_SANDBOX_ACTIONS = [
  "start_trial",
  "activate",
  "past_due",
  "cancel",
  "reactivate",
  "reset",
] as const;

export const BillingStatusSchema = z.enum(BILLING_STATUSES);
export const BillingIntervalSchema = z.enum(BILLING_INTERVALS);
export const LocalBillingSandboxActionSchema = z.enum(LOCAL_BILLING_SANDBOX_ACTIONS);

export const HouseholdBillingRecordSchema = z.object({
  planKey: z.string().min(1),
  planName: z.string().min(1),
  billingInterval: BillingIntervalSchema,
  status: BillingStatusSchema,
  learnerCap: z.number().int().min(1),
  stripeCustomerId: z.string().min(1).nullable().optional(),
  stripeSubscriptionId: z.string().min(1).nullable().optional(),
  stripePriceId: z.string().min(1).nullable().optional(),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  updatedAt: z.string().datetime().nullable().optional(),
});

export type BillingStatus = z.infer<typeof BillingStatusSchema>;
export type BillingInterval = z.infer<typeof BillingIntervalSchema>;
export type LocalBillingSandboxAction = z.infer<typeof LocalBillingSandboxActionSchema>;
export type HouseholdBillingRecord = z.infer<typeof HouseholdBillingRecordSchema>;

export type HouseholdBillingSummary = {
  record: HouseholdBillingRecord;
  activeLearnerCount: number;
  remainingLearnerSlots: number;
  statusLabel: string;
  hasStripeConfiguration: boolean;
  localSandboxEnabled: boolean;
  canStartCheckout: boolean;
  canManageBilling: boolean;
};
