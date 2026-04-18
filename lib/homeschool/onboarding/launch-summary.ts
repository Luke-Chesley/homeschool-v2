"use client";

import { z } from "zod";

const SESSION_STORAGE_KEY = "homeschool-onboarding-launch-summary";

export const OnboardingLaunchSummarySchema = z.object({
  chosenHorizon: z.enum([
    "single_day",
    "few_days",
    "one_week",
    "two_weeks",
    "starter_module",
  ]),
  lessonCount: z.number().int().positive(),
  summaryText: z.string().min(1),
  scopeSummary: z.string().nullable().optional(),
  usedSlice: z.boolean(),
  initialSliceLabel: z.string().nullable().optional(),
});

export type OnboardingLaunchSummary = z.infer<typeof OnboardingLaunchSummarySchema>;

function isBrowser() {
  return typeof window !== "undefined";
}

export function persistOnboardingLaunchSummary(summary: unknown) {
  if (!isBrowser()) {
    return;
  }

  const parsed = OnboardingLaunchSummarySchema.safeParse(summary);
  if (!parsed.success) {
    return;
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed.data));
}

export function consumeOnboardingLaunchSummary() {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  try {
    const parsed = OnboardingLaunchSummarySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
