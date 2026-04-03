import "server-only";

import { createRepositories } from "@/lib/db";
import { ensureDatabaseReady, getDb } from "@/lib/db/server";

type OrganizationRecord = {
  id: string;
  type: "household" | "tutor_practice" | "co_op" | "school_like";
};

type TemplateKey =
  | "homeschool"
  | "tutoring_practice"
  | "classroom_support"
  | "workforce_onboarding"
  | "certification_prep"
  | "bootcamp"
  | "self_guided";

export type OrganizationPlatformSettingsRecord = Awaited<
  ReturnType<ReturnType<typeof createRepositories>["organizations"]["findPlatformSettings"]>
>;

type PlatformDefaults = NonNullable<OrganizationPlatformSettingsRecord>;

const TEMPLATE_DEFAULTS: Record<TemplateKey, Omit<PlatformDefaults, "id" | "organizationId" | "createdAt" | "updatedAt">> = {
  homeschool: {
    workflowMode: "family_guided",
    reportingMode: "progress_journal",
    templateKey: "homeschool",
    primaryGuideLabel: "Parent",
    learnerLabel: "Learner",
    sessionLabel: "Lesson",
    moduleLabel: "Unit",
    activityLabel: "Practice",
    checkpointLabel: "Checkpoint",
    terminology: {
      guidePlural: "Parents",
      learnerPlural: "Learners",
      modulePlural: "Units",
      sessionPlural: "Lessons",
    },
    progressDefaults: {
      primaryModel: "percent_completion",
      allowMasteryBands: true,
    },
    evidenceDefaults: {
      reviewRequired: false,
      defaultAudience: "shared",
      suggestedTypes: ["note", "artifact_output", "activity_outcome"],
    },
    reportDefaults: {
      packs: ["progress_journal", "homeschool_records"],
    },
    metadata: {},
  },
  tutoring_practice: {
    workflowMode: "educator_led",
    reportingMode: "progress_journal",
    templateKey: "tutoring_practice",
    primaryGuideLabel: "Tutor",
    learnerLabel: "Learner",
    sessionLabel: "Session",
    moduleLabel: "Module",
    activityLabel: "Practice",
    checkpointLabel: "Checkpoint",
    terminology: {
      guidePlural: "Tutors",
      learnerPlural: "Learners",
    },
    progressDefaults: {
      primaryModel: "percent_completion",
      allowMasteryBands: true,
    },
    evidenceDefaults: {
      reviewRequired: false,
      defaultAudience: "shared",
      suggestedTypes: ["note", "activity_outcome", "artifact_output"],
    },
    reportDefaults: {
      packs: ["progress_journal", "session_summary"],
    },
    metadata: {},
  },
  classroom_support: {
    workflowMode: "educator_led",
    reportingMode: "standards_tracking",
    templateKey: "classroom_support",
    primaryGuideLabel: "Teacher",
    learnerLabel: "Student",
    sessionLabel: "Lesson",
    moduleLabel: "Unit",
    activityLabel: "Assignment",
    checkpointLabel: "Checkpoint",
    terminology: {
      guidePlural: "Teachers",
      learnerPlural: "Students",
    },
    progressDefaults: {
      primaryModel: "percent_completion",
      allowMasteryBands: true,
    },
    evidenceDefaults: {
      reviewRequired: true,
      defaultAudience: "shared",
      suggestedTypes: ["activity_outcome", "artifact_output", "review_note"],
    },
    reportDefaults: {
      packs: ["standards_tracking", "coverage_summary"],
    },
    metadata: {},
  },
  workforce_onboarding: {
    workflowMode: "manager_led",
    reportingMode: "onboarding_completion",
    templateKey: "workforce_onboarding",
    primaryGuideLabel: "Manager",
    learnerLabel: "Trainee",
    sessionLabel: "Session",
    moduleLabel: "Module",
    activityLabel: "Assignment",
    checkpointLabel: "Sign-off",
    terminology: {
      guidePlural: "Managers",
      learnerPlural: "Trainees",
    },
    progressDefaults: {
      primaryModel: "reviewer_approval",
      allowMasteryBands: false,
    },
    evidenceDefaults: {
      reviewRequired: true,
      defaultAudience: "reviewer_only",
      suggestedTypes: ["file_upload", "activity_outcome", "review_note"],
    },
    reportDefaults: {
      packs: ["onboarding_completion", "manager_review_summary"],
    },
    metadata: {},
  },
  certification_prep: {
    workflowMode: "self_guided",
    reportingMode: "certification_tracking",
    templateKey: "certification_prep",
    primaryGuideLabel: "Coach",
    learnerLabel: "Candidate",
    sessionLabel: "Study session",
    moduleLabel: "Domain",
    activityLabel: "Practice",
    checkpointLabel: "Checkpoint",
    terminology: {
      guidePlural: "Coaches",
      learnerPlural: "Candidates",
    },
    progressDefaults: {
      primaryModel: "percent_completion",
      allowMasteryBands: true,
    },
    evidenceDefaults: {
      reviewRequired: false,
      defaultAudience: "shared",
      suggestedTypes: ["activity_outcome", "external_assessment", "note"],
    },
    reportDefaults: {
      packs: ["certification_tracking", "readiness_summary"],
    },
    metadata: {},
  },
  bootcamp: {
    workflowMode: "cohort_based",
    reportingMode: "competency_tracking",
    templateKey: "bootcamp",
    primaryGuideLabel: "Instructor",
    learnerLabel: "Learner",
    sessionLabel: "Lab",
    moduleLabel: "Module",
    activityLabel: "Practice",
    checkpointLabel: "Checkpoint",
    terminology: {
      guidePlural: "Instructors",
      learnerPlural: "Learners",
    },
    progressDefaults: {
      primaryModel: "competency_demonstrated",
      allowMasteryBands: true,
    },
    evidenceDefaults: {
      reviewRequired: true,
      defaultAudience: "shared",
      suggestedTypes: ["activity_outcome", "file_upload", "artifact_output"],
    },
    reportDefaults: {
      packs: ["competency_tracking", "cohort_progress"],
    },
    metadata: {},
  },
  self_guided: {
    workflowMode: "self_guided",
    reportingMode: "competency_tracking",
    templateKey: "self_guided",
    primaryGuideLabel: "Coach",
    learnerLabel: "Learner",
    sessionLabel: "Session",
    moduleLabel: "Pathway",
    activityLabel: "Practice",
    checkpointLabel: "Checkpoint",
    terminology: {
      guidePlural: "Coaches",
      learnerPlural: "Learners",
    },
    progressDefaults: {
      primaryModel: "competency_demonstrated",
      allowMasteryBands: true,
    },
    evidenceDefaults: {
      reviewRequired: false,
      defaultAudience: "shared",
      suggestedTypes: ["activity_outcome", "reflection", "note"],
    },
    reportDefaults: {
      packs: ["competency_tracking", "reflection_log"],
    },
    metadata: {},
  },
};

function getTemplateForOrganization(organization: OrganizationRecord): TemplateKey {
  switch (organization.type) {
    case "household":
      return "homeschool";
    case "tutor_practice":
      return "tutoring_practice";
    case "co_op":
      return "classroom_support";
    case "school_like":
      return "classroom_support";
    default:
      return "homeschool";
  }
}

export function getTemplateDefaults(templateKey: TemplateKey) {
  return TEMPLATE_DEFAULTS[templateKey];
}

export async function ensureOrganizationPlatformSettings(organization: OrganizationRecord) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const existing = await repos.organizations.findPlatformSettings(organization.id);

  if (existing) {
    return existing;
  }

  const templateKey = getTemplateForOrganization(organization);
  const defaults = getTemplateDefaults(templateKey);

  return repos.organizations.upsertPlatformSettings({
    organizationId: organization.id,
    ...defaults,
  });
}

export async function getOrganizationPlatformSettings(organization: OrganizationRecord) {
  return ensureOrganizationPlatformSettings(organization);
}

export function getPlatformLabel(
  settings: Pick<
    NonNullable<OrganizationPlatformSettingsRecord>,
    | "primaryGuideLabel"
    | "learnerLabel"
    | "sessionLabel"
    | "moduleLabel"
    | "activityLabel"
    | "checkpointLabel"
  >,
  key: "guide" | "learner" | "session" | "module" | "activity" | "checkpoint",
) {
  switch (key) {
    case "guide":
      return settings.primaryGuideLabel;
    case "learner":
      return settings.learnerLabel;
    case "session":
      return settings.sessionLabel;
    case "module":
      return settings.moduleLabel;
    case "activity":
      return settings.activityLabel;
    case "checkpoint":
      return settings.checkpointLabel;
  }
}
