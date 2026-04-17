import { createAiIntakeRepository } from "@/lib/db/repositories/ai-intake";
import type { HomeschoolDb } from "@/lib/db/client";
import { createActivitiesRepository } from "@/lib/db/repositories/activities";
import { createCopilotRepository } from "@/lib/db/repositories/copilot";
import { createComplianceRepository } from "@/lib/db/repositories/compliance";
import { createCurriculumRepository } from "@/lib/db/repositories/curriculum";
import { createCurriculumRoutingRepository } from "@/lib/db/repositories/curriculum-routing";
import { createLearnerRepository } from "@/lib/db/repositories/learners";
import { createObservabilityRepository } from "@/lib/db/repositories/observability";
import { createOrganizationRepository } from "@/lib/db/repositories/organizations";
import { createPlanningRepository } from "@/lib/db/repositories/planning";
import { createStandardsRepository } from "@/lib/db/repositories/standards";
import { createTrackingRepository } from "@/lib/db/repositories/tracking";

export function createRepositories(db: HomeschoolDb) {
  return {
    aiIntake: createAiIntakeRepository(db),
    organizations: createOrganizationRepository(db),
    observability: createObservabilityRepository(db),
    learners: createLearnerRepository(db),
    compliance: createComplianceRepository(db),
    standards: createStandardsRepository(db),
    curriculum: createCurriculumRepository(db),
    curriculumRouting: createCurriculumRoutingRepository(db),
    planning: createPlanningRepository(db),
    activities: createActivitiesRepository(db),
    tracking: createTrackingRepository(db),
    copilot: createCopilotRepository(db),
  };
}
