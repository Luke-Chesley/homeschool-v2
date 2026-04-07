"use server";

import { revalidatePath } from "next/cache";

import { requireAppSession } from "@/lib/app-session/server";
import { regenerateCurriculumProgression } from "@/lib/curriculum/progression-regeneration";
import type { RegenerateProgressionResult } from "@/lib/curriculum/progression-regeneration";

export async function regenerateProgressionAction(
  sourceId: string,
): Promise<RegenerateProgressionResult & { error?: string }> {
  try {
    const session = await requireAppSession();

    const learnerDisplayName =
      session.activeLearner?.displayName ?? "Learner";

    const result = await regenerateCurriculumProgression({
      sourceId,
      householdId: session.organization.id,
      learnerDisplayName,
    });

    if (result.kind === "success") {
      revalidatePath(`/curriculum/graph`);
    }

    return result;
  } catch (error) {
    console.error("[regenerateProgressionAction] Unexpected error", { sourceId, error });
    return {
      kind: "failure",
      reason: error instanceof Error ? error.message : "An unexpected error occurred.",
      attemptCount: 0,
    };
  }
}
