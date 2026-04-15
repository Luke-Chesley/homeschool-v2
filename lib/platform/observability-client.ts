import type { ProductEvent } from "@/lib/platform/observability-shared";

export async function trackProductEvent(event: ProductEvent) {
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
}
