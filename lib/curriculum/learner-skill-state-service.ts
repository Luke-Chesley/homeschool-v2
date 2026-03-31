import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";

import { buildRecommendationAdaptationInputs } from "./learner-skill-feedback";

function getCurriculumRoutingRepo() {
  return createRepositories(getDb()).curriculumRouting;
}

export async function getRecommendationAdaptationInputs(params: {
  learnerId: string;
  sourceId: string;
}) {
  const states = await getCurriculumRoutingRepo().listSkillStatesForSource(
    params.learnerId,
    params.sourceId,
  );

  return buildRecommendationAdaptationInputs({
    learnerId: params.learnerId,
    sourceId: params.sourceId,
    states: states.map((state) => ({
      skillNodeId: state.skillNodeId,
      status: state.status,
      statusReason: state.statusReason,
      lastScheduledAt: state.lastScheduledAt,
      updatedAt: state.updatedAt,
    })),
  });
}
