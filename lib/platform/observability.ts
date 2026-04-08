type ProductEvent = {
  name: string;
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
