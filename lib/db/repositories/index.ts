import type { HomeschoolDb } from "@/lib/db/client";
import { createActivitiesRepository } from "@/lib/db/repositories/activities";
import { createCopilotRepository } from "@/lib/db/repositories/copilot";
import { createCurriculumRepository } from "@/lib/db/repositories/curriculum";
import { createCurriculumRoutingRepository } from "@/lib/db/repositories/curriculum-routing";
import { createLearnerRepository } from "@/lib/db/repositories/learners";
import { createOrganizationRepository } from "@/lib/db/repositories/organizations";
import { createPlanningRepository } from "@/lib/db/repositories/planning";
import { createStandardsRepository } from "@/lib/db/repositories/standards";
import { createTrackingRepository } from "@/lib/db/repositories/tracking";

export function createRepositories(db: HomeschoolDb) {
  return {
    organizations: createOrganizationRepository(db),
    learners: createLearnerRepository(db),
    standards: createStandardsRepository(db),
    curriculum: createCurriculumRepository(db),
    curriculumRouting: createCurriculumRoutingRepository(db),
    planning: createPlanningRepository(db),
    activities: createActivitiesRepository(db),
    tracking: createTrackingRepository(db),
    copilot: createCopilotRepository(db),
  };
}
