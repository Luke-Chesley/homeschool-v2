import { createId } from "@/lib/db/ids";

export function buildDemoOrganizationFixture() {
  const organizationId = createId("org");
  const learnerId = createId("learner");
  const planId = createId("plan");

  return {
    organization: {
      id: organizationId,
      name: "Riverside Homeschool",
      slug: "riverside-homeschool",
      type: "household" as const,
      timezone: "America/Los_Angeles",
      metadata: {},
    },
    learner: {
      id: learnerId,
      organizationId,
      firstName: "Maya",
      displayName: "Maya",
      timezone: "America/Los_Angeles",
      status: "active" as const,
      metadata: {},
    },
    plan: {
      id: planId,
      organizationId,
      learnerId,
      title: "Spring term",
      status: "active" as const,
      metadata: {},
    },
  };
}
