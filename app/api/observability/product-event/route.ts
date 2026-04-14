import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppApiSession } from "@/lib/app-session/server";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackProductEvent } from "@/lib/platform/observability";

const ProductEventSchema = z.object({
  name: z.string().min(1).max(120),
  organizationId: z.string().min(1),
  learnerId: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireAppApiSession({ requireLearner: false });
  const body = await request.json().catch(() => null);
  const parsed = ProductEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product event payload." }, { status: 400 });
  }

  if (parsed.data.organizationId !== session.organization.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  await trackProductEvent(parsed.data);

  if (
    parsed.data.name === ACTIVATION_EVENT_NAMES.todayOpened &&
    parsed.data.metadata?.returnDayMarker === "day_2"
  ) {
    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.returnedDay2,
      organizationId: parsed.data.organizationId,
      learnerId: parsed.data.learnerId ?? null,
      metadata: { source: "today_tracker" },
    });
  }

  if (
    parsed.data.name === ACTIVATION_EVENT_NAMES.todayOpened &&
    parsed.data.metadata?.returnDayMarker === "day_7"
  ) {
    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.returnedDay7,
      organizationId: parsed.data.organizationId,
      learnerId: parsed.data.learnerId ?? null,
      metadata: { source: "today_tracker" },
    });
  }

  return NextResponse.json({ ok: true });
}
