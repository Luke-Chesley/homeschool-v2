import { NextRequest, NextResponse } from "next/server";

import { getBillingConfiguration } from "@/lib/billing/service";
import { getStripeServerClient, handleStripeWebhookEvent } from "@/lib/billing/stripe";

export async function POST(request: NextRequest) {
  const config = getBillingConfiguration();
  if (!config.hasStripeConfiguration || !config.stripeWebhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripeServerClient();

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);
    await handleStripeWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook event.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
