import type { ErrorEvent, ProductEvent } from "@/lib/platform/observability-shared";

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
