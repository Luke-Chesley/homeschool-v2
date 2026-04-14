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

async function persistProductEvent(event: ProductEvent) {
  if (!event.organizationId) {
    return;
  }

  const [{ ensureDatabaseReady, getDb }, { productEvents }] = await Promise.all([
    import("@/lib/db/server"),
    import("@/lib/db/schema"),
  ]);

  await ensureDatabaseReady();
  await getDb().insert(productEvents).values({
    organizationId: event.organizationId,
    learnerId: event.learnerId ?? null,
    name: event.name,
    metadata: event.metadata ?? {},
  });
}

export async function trackProductEvent(event: ProductEvent) {
  console.info("[observability] product_event", event);

  if (typeof window !== "undefined") {
    if (!event.organizationId) {
      return;
    }

    try {
      await fetch("/api/observability/product-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
        keepalive: true,
      });
    } catch (error) {
      console.warn("[observability] client_event_failed", error);
    }

    return;
  }

  try {
    await persistProductEvent(event);
  } catch (error) {
    console.error("[observability] persist_failed", error);
  }
}

export function trackOperationalError(event: ErrorEvent) {
  console.error("[observability] error", event);
}
