"use server";

import { revalidatePath } from "next/cache";

import { requireAppSession } from "@/lib/app-session/server";
import { updateRecommendationDecision } from "@/lib/tracking/service";

export async function applyTrackingRecommendationAction(formData: FormData) {
  const session = await requireAppSession();
  const recommendationId = formData.get("recommendationId");
  const action = formData.get("action");

  if (
    typeof recommendationId !== "string" ||
    (action !== "accept" && action !== "override")
  ) {
    return;
  }

  await updateRecommendationDecision({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    recommendationId,
    action,
  });

  revalidatePath("/tracking");
}
