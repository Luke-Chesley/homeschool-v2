import type { ActivationEventName } from "@/lib/homeschool/onboarding/activation-contracts";

export type ProductEventName = ActivationEventName | "homeschool_onboarding_completed" | "attendance_updated" | "report_export_requested" | (string & {});

export type ProductEvent = {
  name: ProductEventName;
  organizationId?: string;
  learnerId?: string | null;
  metadata?: Record<string, unknown>;
};

type ErrorEvent = {
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export function trackProductEvent(event: ProductEvent) {
  console.info("[observability] product_event", event);
}

export function trackOperationalError(event: ErrorEvent) {
  console.error("[observability] error", event);
}
