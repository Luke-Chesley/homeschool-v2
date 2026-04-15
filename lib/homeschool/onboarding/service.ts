import "@/lib/server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { homeschoolTemplate } from "@/config/templates/homeschool";
import {
  createCurriculumSourceFromAiDraftArtifact,
  importStructuredCurriculumDocument,
  setLiveCurriculumSource,
} from "@/lib/curriculum/service";
import type { CurriculumAiChatMessage } from "@/lib/curriculum/ai-draft";
import { generateCurriculumArtifact } from "@/lib/curriculum/ai-draft-service";
import type { ImportedCurriculumDocument } from "@/lib/curriculum/local-json-import";
import { getDb } from "@/lib/db/server";
import { learnerProfiles, learners, organizationPlatformSettings, organizations } from "@/lib/db/schema";
import { getTodayWorkspace } from "@/lib/planning/today-service";
import { getOrCreateWeeklyRouteBoardForLearner } from "@/lib/planning/weekly-route-service";
import { recordHomeschoolAuditEvent } from "@/lib/homeschool/reporting/service";
import {
  ACTIVATION_EVENT_NAMES,
  ONBOARDING_MILESTONES,
  type OnboardingMilestone,
} from "@/lib/homeschool/onboarding/activation-contracts";
import { getNormalizedIntakeSourcePackage } from "@/lib/homeschool/intake/service";
import { trackProductEvent } from "@/lib/platform/observability";

import {
  CURRICULUM_GENERATION_HORIZONS,
  CURRICULUM_HORIZON_DECISION_SOURCES,
  CURRICULUM_INTAKE_CONFIDENCE_LEVELS,
  FAST_PATH_INTAKE_ROUTES,
  LEGACY_FAST_PATH_INTAKE_ROUTES,
} from "@/lib/homeschool/onboarding/types";
import type {
  CurriculumGenerationHorizon,
  CurriculumHorizonDecisionSource,
  CurriculumIntakeConfidence,
  FastPathIntakeRoute,
  HomeschoolFastPathOnboardingInput,
  HomeschoolOnboardingInput,
  HomeschoolOnboardingStatus,
  HomeschoolFastPathPreview,
} from "@/lib/homeschool/onboarding/types";

const LearnerSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  gradeLevel: z.string().trim().max(40).optional(),
  ageBand: z.string().trim().max(40).optional(),
  pacePreference: z.enum(["gentle", "balanced", "accelerated"]).optional(),
  loadPreference: z.enum(["light", "balanced", "ambitious"]).optional(),
});

export const HomeschoolOnboardingSchema = z.object({
  organizationId: z.string().min(1),
  householdName: z.string().trim().min(1).max(120),
  schoolYearLabel: z.string().trim().max(80).optional(),
  termStartDate: z.string().trim().max(20).optional(),
  termEndDate: z.string().trim().max(20).optional(),
  preferredSchoolDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  dailyTimeBudgetMinutes: z.number().int().min(30).max(480),
  subjects: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  standardsPreference: z.string().trim().max(80).optional(),
  teachingStyle: z.string().trim().max(160).optional(),
  learners: z.array(LearnerSchema).min(1).max(8),
  curriculumMode: z.enum(["manual_shell", "paste_outline", "ai_decompose"]),
  curriculumTitle: z.string().trim().min(1).max(160),
  curriculumSummary: z.string().trim().max(600).optional(),
  curriculumText: z.string().trim().max(12000).optional(),
  curriculumSourceMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const HomeschoolCurriculumIntakeSchema = z.object({
  organizationId: z.string().min(1),
  learnerId: z.string().min(1),
  learnerName: z.string().min(1),
  learnerFirstName: z.string().min(1),
  learnerLastName: z.string().nullable().optional(),
  schoolYearLabel: z.string().trim().max(80).optional(),
  subjects: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  teachingStyle: z.string().trim().max(160).optional(),
  curriculumMode: z.enum(["manual_shell", "paste_outline", "ai_decompose"]),
  curriculumTitle: z.string().trim().min(1).max(160),
  curriculumSummary: z.string().trim().max(600).optional(),
  curriculumText: z.string().trim().max(12000).optional(),
});

export type HomeschoolOnboardingPayload = z.infer<typeof HomeschoolOnboardingSchema>;
export type HomeschoolCurriculumIntakePayload = z.infer<typeof HomeschoolCurriculumIntakeSchema>;

const CanonicalFastPathIntakeRouteSchema = z.enum(FAST_PATH_INTAKE_ROUTES);
const LegacyFastPathIntakeRouteSchema = z.enum(LEGACY_FAST_PATH_INTAKE_ROUTES);
const FastPathIntakeRouteInputSchema = z.union([
  CanonicalFastPathIntakeRouteSchema,
  LegacyFastPathIntakeRouteSchema,
]);
const CurriculumGenerationHorizonSchema = z.enum(CURRICULUM_GENERATION_HORIZONS);
const CurriculumHorizonDecisionSourceSchema = z.enum(CURRICULUM_HORIZON_DECISION_SOURCES);
const CurriculumIntakeConfidenceSchema = z.enum(CURRICULUM_INTAKE_CONFIDENCE_LEVELS);

function normalizeFastPathIntakeRoute(route: z.infer<typeof FastPathIntakeRouteInputSchema>): FastPathIntakeRoute {
  switch (route) {
    case "book_curriculum":
      return "single_lesson";
    case "outline_weekly_plan":
      return "weekly_plan";
    default:
      return route;
  }
}

const RawHomeschoolFastPathOnboardingSchema = z.object({
  organizationId: z.string().min(1),
  learnerName: z.string().trim().min(1).max(80),
  intakeRoute: FastPathIntakeRouteInputSchema.optional(),
  intakeType: FastPathIntakeRouteInputSchema.optional(),
  sourceInput: z.string().trim().min(1).max(12000).optional(),
  sourcePackageId: z.string().min(1).optional(),
  horizonIntent: z.enum(["today_only", "auto"]).optional(),
  confirmPreview: z.boolean().optional(),
  previewCorrections: z
    .object({
      learnerName: z.string().trim().min(1).max(80).optional(),
      intakeRoute: CanonicalFastPathIntakeRouteSchema.optional(),
      title: z.string().trim().min(1).max(160).optional(),
      chosenHorizon: CurriculumGenerationHorizonSchema.optional(),
    })
    .optional(),
});

export const HomeschoolFastPathOnboardingSchema = RawHomeschoolFastPathOnboardingSchema.superRefine(
  (input, ctx) => {
    if (!input.intakeRoute && !input.intakeType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Intake route is required.",
        path: ["intakeRoute"],
      });
    }

    if (!input.sourceInput && !input.sourcePackageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source input or source package is required.",
        path: ["sourceInput"],
      });
    }
  },
).transform((input) => ({
  organizationId: input.organizationId,
  learnerName: input.learnerName,
  intakeRoute: normalizeFastPathIntakeRoute(input.intakeRoute ?? input.intakeType!),
  sourceInput: input.sourceInput,
  sourcePackageId: input.sourcePackageId,
  horizonIntent: input.horizonIntent,
  confirmPreview: input.confirmPreview,
  previewCorrections: input.previewCorrections,
}));

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function splitDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const [firstName = displayName.trim(), ...rest] = parts;

  return {
    firstName,
    lastName: rest.length > 0 ? rest.join(" ") : null,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "homeschool";
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeSubjects(subjects: string[]) {
  return uniqueStrings(subjects).slice(0, 12);
}

function toMilestoneList(value: unknown): OnboardingMilestone[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is OnboardingMilestone =>
    ONBOARDING_MILESTONES.includes(entry as OnboardingMilestone),
  );
}

function mergeMilestone(existing: OnboardingMilestone[], milestone: OnboardingMilestone) {
  if (existing.includes(milestone)) {
    return existing;
  }

  return [...existing, milestone];
}

function mergeSourceMetadata(
  base: Record<string, unknown>,
  extra: Record<string, unknown> | undefined,
) {
  return {
    ...base,
    ...(extra ?? {}),
  };
}

function buildStarterDocument(input: HomeschoolOnboardingInput) {
  const lessonsPerSubject = ["Warm-up", "Core lesson", "Review and evidence"];

  return {
    title: input.curriculumTitle,
    description:
      input.curriculumSummary ??
      `Starter curriculum shell for ${input.householdName}.`,
    kind: "manual" as const,
    academicYear: input.schoolYearLabel,
    subjects: input.subjects,
    gradeLevels: uniqueStrings(
      input.learners
        .map((learner) => learner.gradeLevel)
        .filter((value): value is string => Boolean(value)),
    ),
    document: Object.fromEntries(
      input.subjects.map((subject) => [
        subject,
        {
          Foundations: lessonsPerSubject.map((lesson) => `${subject}: ${lesson}`),
        },
      ]),
    ),
    units: input.subjects.map((subject) => ({
      title: subject,
      description: `Starter sequence for ${subject}.`,
      estimatedSessions: lessonsPerSubject.length,
      lessons: lessonsPerSubject.map((lesson, index) => ({
        title: `${subject}: ${lesson}`,
        description:
          index === 0
            ? `Open the week with a manageable ${subject.toLowerCase()} session.`
            : index === 1
              ? `Teach the next concrete ${subject.toLowerCase()} skill.`
              : `Capture what was learned and what needs to carry forward.`,
        subject,
        estimatedMinutes: Math.max(
          20,
          Math.round(input.dailyTimeBudgetMinutes / Math.max(input.subjects.length, 1)),
        ),
        materials: [],
        objectives: [],
        linkedSkillTitles: [],
      })),
    })),
    metadata: {
      ...mergeSourceMetadata(
        {
          lineage: {
            mode: "manual_shell",
            createdFromOnboarding: true,
          },
        },
        input.curriculumSourceMetadata,
      ),
    },
  };
}

type OutlineNode = {
  title: string;
  children: OutlineNode[];
};

type CurriculumJsonNode =
  | string
  | string[]
  | {
      [key: string]: CurriculumJsonNode;
    };

function detectOutlineLevel(line: string) {
  const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    return {
      level: headingMatch[1].length,
      title: headingMatch[2].trim(),
    };
  }

  const bulletMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
  if (bulletMatch) {
    return {
      level: 2 + Math.floor(bulletMatch[1].replace(/\t/g, "  ").length / 2),
      title: bulletMatch[3].trim(),
    };
  }

  return {
    level: 1,
    title: line.trim(),
  };
}

function buildOutlineTree(text: string) {
  const root: OutlineNode = { title: "__root__", children: [] };
  const stack: Array<{ level: number; node: OutlineNode }> = [{ level: 0, node: root }];

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) {
      continue;
    }

    const entry = detectOutlineLevel(rawLine);
    if (!entry.title) {
      continue;
    }

    while (stack.length > 1 && stack[stack.length - 1]!.level >= entry.level) {
      stack.pop();
    }

    const node: OutlineNode = {
      title: entry.title,
      children: [],
    };
    stack[stack.length - 1]!.node.children.push(node);
    stack.push({ level: entry.level, node });
  }

  return root.children;
}

function nodeToDocument(node: OutlineNode): CurriculumJsonNode {
  if (node.children.length === 0) {
    return [node.title];
  }

  return Object.fromEntries(node.children.map((child) => [child.title, nodeToDocument(child)]));
}

function buildLessonsFromNode(subject: string, node: OutlineNode) {
  if (node.children.length === 0) {
    return [
      {
        title: node.title,
        description: `Work through ${node.title}.`,
        subject,
        estimatedMinutes: 45,
        materials: [],
        objectives: [],
        linkedSkillTitles: [],
      },
    ];
  }

  return node.children.map((child) => ({
    title: child.title,
    description: `Cover ${child.title} within ${node.title}.`,
    subject,
    estimatedMinutes: 45,
    materials: [],
    objectives: child.children.map((grandchild) => grandchild.title),
    linkedSkillTitles: child.children.map((grandchild) => grandchild.title),
  }));
}

function buildStructuredDocumentFromOutline(input: HomeschoolOnboardingInput) {
  const outlineRoots = buildOutlineTree(input.curriculumText ?? "");
  const roots = outlineRoots.length > 0
    ? outlineRoots
    : input.subjects.map((subject) => ({ title: subject, children: [] }));
  const document: Record<string, CurriculumJsonNode> = Object.fromEntries(
    roots.map((node) => [node.title, nodeToDocument(node)]),
  );

  return {
    title: input.curriculumTitle,
    description: input.curriculumSummary ?? "Imported from pasted outline.",
    kind: "manual" as const,
    academicYear: input.schoolYearLabel,
    subjects: input.subjects,
    gradeLevels: uniqueStrings(
      input.learners
        .map((learner) => learner.gradeLevel)
        .filter((value): value is string => Boolean(value)),
    ),
    document,
    units: roots.map((node) => ({
      title: node.title,
      description: `Imported from pasted outline for ${node.title}.`,
      estimatedSessions: Math.max(node.children.length, 1),
      lessons: buildLessonsFromNode(node.title, node),
    })),
    metadata: {
      ...mergeSourceMetadata(
        {
          lineage: {
            mode: "paste_outline",
            createdFromOnboarding: true,
            rawTextLength: (input.curriculumText ?? "").length,
          },
        },
        input.curriculumSourceMetadata,
      ),
    },
  };
}

function buildAiMessages(input: HomeschoolOnboardingInput): CurriculumAiChatMessage[] {
  const learnerSummary = input.learners
    .map((learner) => `${learner.displayName}${learner.gradeLevel ? ` (${learner.gradeLevel})` : ""}`)
    .join(", ");

  return [
    {
      role: "user",
      content: `Build a homeschool curriculum for ${learnerSummary}.`,
    },
    {
      role: "user",
      content: [
        `Household: ${input.householdName}`,
        `Subjects: ${input.subjects.join(", ")}`,
        input.schoolYearLabel ? `School year: ${input.schoolYearLabel}` : null,
        input.teachingStyle ? `Teaching style: ${input.teachingStyle}` : null,
        input.curriculumSummary ? `Parent summary: ${input.curriculumSummary}` : null,
        input.curriculumText ? `Source material:\n${input.curriculumText}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export async function getHomeschoolOnboardingStatus(organizationId: string) {
  const organization = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  const metadata = asRecord(organization?.metadata);
  const homeschool = asRecord(metadata.homeschool);
  const onboarding = asRecord(homeschool.onboarding);
  const milestones = toMilestoneList(onboarding.milestones);
  const currentMilestone = milestones[milestones.length - 1] ?? null;
  const completedAt = typeof onboarding.completedAt === "string" ? onboarding.completedAt : null;
  const isComplete =
    completedAt !== null ||
    milestones.includes("first_day_ready") ||
    milestones.includes("week_ready");

  return { isComplete, completedAt, milestones, currentMilestone } satisfies HomeschoolOnboardingStatus;
}

export async function createHomeschoolCurriculumFromIntake(
  rawInput: z.infer<typeof HomeschoolCurriculumIntakeSchema>,
) {
  const input = HomeschoolCurriculumIntakeSchema.parse(rawInput);
  const normalizedSubjects = normalizeSubjects(input.subjects);
  const learner = {
    id: input.learnerId,
    organizationId: input.organizationId,
    displayName: input.learnerName,
    firstName: input.learnerFirstName,
    lastName: input.learnerLastName ?? null,
    status: "active" as const,
  };

  const curriculumInput: HomeschoolOnboardingInput = {
    organizationId: input.organizationId,
    householdName: "Homeschool",
    preferredSchoolDays: [...homeschoolTemplate.defaults.schoolDays],
    dailyTimeBudgetMinutes: homeschoolTemplate.defaults.dailyTimeBudgetMinutes,
    subjects: normalizedSubjects,
    learners: [
      {
        displayName: input.learnerName,
      },
    ],
    curriculumMode: input.curriculumMode,
    curriculumTitle: input.curriculumTitle,
    curriculumSummary: input.curriculumSummary,
    curriculumText: input.curriculumText,
    schoolYearLabel: input.schoolYearLabel,
    teachingStyle: input.teachingStyle,
  };

  const curriculum = await initializeCurriculum(curriculumInput, {
    id: learner.id,
    organizationId: learner.organizationId,
    firstName: learner.firstName,
    lastName: learner.lastName,
    displayName: learner.displayName,
    timezone: "America/Los_Angeles",
    status: learner.status,
    dateOfBirth: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
  });

  const sourceId = "sourceId" in curriculum ? curriculum.sourceId : curriculum.id;
  await setLiveCurriculumSource(input.organizationId, sourceId);
  await recordHomeschoolAuditEvent({
    organizationId: input.organizationId,
    learnerId: input.learnerId,
    entityType: "curriculum",
    entityId: sourceId,
    eventType: "curriculum.created",
    summary: `Created curriculum "${input.curriculumTitle}" via ${input.curriculumMode}.`,
    metadata: {
      curriculumMode: input.curriculumMode,
      subjects: normalizedSubjects,
    },
  });

  return {
    sourceId,
  };
}

async function persistHomeschoolSetupBase(input: HomeschoolOnboardingPayload) {
  const db = getDb();

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, input.organizationId),
  });

  if (!organization) {
    throw new Error("Organization not found.");
  }

  const settings = await db.query.organizationPlatformSettings.findFirst({
    where: eq(organizationPlatformSettings.organizationId, input.organizationId),
  });

  const existingMetadata = asRecord(organization.metadata);
  const homeschoolMetadata = asRecord(existingMetadata.homeschool);

  await db
    .update(organizations)
    .set({
      name: input.householdName,
      slug: organization.slug.startsWith("homeschool-")
        ? `${slugify(input.householdName)}-${Date.now()}`
        : organization.slug,
      metadata: {
        ...existingMetadata,
        homeschool: {
          ...homeschoolMetadata,
          onboarding: {
            ...(asRecord(homeschoolMetadata.onboarding)),
            status: "pending",
            completedAt: null,
            milestones: ["fast_path_started", "household_defaults_completed"],
            currentMilestone: "household_defaults_completed",
            schoolYearLabel: input.schoolYearLabel ?? null,
            termStartDate: input.termStartDate ?? null,
            termEndDate: input.termEndDate ?? null,
            subjects: normalizeSubjects(input.subjects),
            teachingStyle: input.teachingStyle ?? null,
          },
          scheduler: {
            preferredSchoolDays: input.preferredSchoolDays,
            dailyTimeBudgetMinutes: input.dailyTimeBudgetMinutes,
          },
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, input.organizationId));

  if (settings) {
    const settingsMetadata = asRecord(settings.metadata);
    await db
      .update(organizationPlatformSettings)
      .set({
        reportDefaults: {
          ...(asRecord(settings.reportDefaults)),
          standardsPreference: input.standardsPreference ?? null,
        },
        metadata: {
          ...settingsMetadata,
          homeschool: {
            teachingStyle: input.teachingStyle ?? null,
            preferredSchoolDays: input.preferredSchoolDays,
            dailyTimeBudgetMinutes: input.dailyTimeBudgetMinutes,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(organizationPlatformSettings.organizationId, input.organizationId));
  }

  const createdLearners = await upsertLearnersForOnboarding(input.organizationId, input.learners);
  const primaryLearner = createdLearners[0];

  if (!primaryLearner) {
    throw new Error("At least one learner is required.");
  }

  return {
    primaryLearner,
    normalizedSubjects: normalizeSubjects(input.subjects),
  };
}

export async function prepareHomeschoolOnboarding(rawInput: unknown) {
  const input = HomeschoolOnboardingSchema.parse(rawInput);
  const { primaryLearner, normalizedSubjects } = await persistHomeschoolSetupBase(input);

  return {
    input: {
      ...input,
      subjects: normalizedSubjects,
    },
    primaryLearner,
  };
}

async function upsertLearnersForOnboarding(
  organizationId: string,
  learnersInput: HomeschoolOnboardingInput["learners"],
) {
  const db = getDb();
  const createdLearners: Array<typeof learners.$inferSelect> = [];

  for (const learnerInput of learnersInput) {
    const normalizedName = learnerInput.displayName.trim();
    const existing = await db.query.learners.findFirst({
      where: and(
        eq(learners.organizationId, organizationId),
        eq(learners.displayName, normalizedName),
      ),
    });

    const learnerRecord =
      existing ??
      (
        await db
          .insert(learners)
          .values({
            organizationId,
            ...splitDisplayName(normalizedName),
            displayName: normalizedName,
            timezone: "America/Los_Angeles",
            status: "active",
            metadata: {},
          })
          .returning()
      )[0]!;

    const existingProfile = await db.query.learnerProfiles.findFirst({
      where: eq(learnerProfiles.learnerId, learnerRecord.id),
    });
    const profileMetadata = asRecord(existingProfile?.metadata);

    await db
      .insert(learnerProfiles)
      .values({
        learnerId: learnerRecord.id,
        gradeLevel: learnerInput.gradeLevel ?? null,
        schedulePreferences: {
          dailyLoad: learnerInput.loadPreference ?? "balanced",
        },
        metadata: {
          ...profileMetadata,
          organizationId,
          homeschool: {
            ageBand: learnerInput.ageBand ?? null,
            pacePreference: learnerInput.pacePreference ?? "balanced",
            loadPreference: learnerInput.loadPreference ?? "balanced",
          },
        },
      })
      .onConflictDoUpdate({
        target: learnerProfiles.learnerId,
        set: {
          gradeLevel: learnerInput.gradeLevel ?? existingProfile?.gradeLevel ?? null,
          schedulePreferences: {
            dailyLoad: learnerInput.loadPreference ?? "balanced",
          },
          metadata: {
            ...profileMetadata,
            organizationId,
            homeschool: {
              ageBand: learnerInput.ageBand ?? null,
              pacePreference: learnerInput.pacePreference ?? "balanced",
              loadPreference: learnerInput.loadPreference ?? "balanced",
            },
          },
          updatedAt: new Date(),
        },
      });

    createdLearners.push(learnerRecord);
  }

  return createdLearners;
}

async function initializeCurriculum(input: HomeschoolOnboardingInput, learner: typeof learners.$inferSelect) {
  if (input.curriculumMode === "ai_decompose" && input.curriculumText?.trim()) {
    const generation = await generateCurriculumArtifact({
      learner: {
        id: learner.id,
        organizationId: learner.organizationId,
        displayName: learner.displayName,
        firstName: learner.firstName,
        lastName: learner.lastName,
        status: learner.status,
      },
      messages: buildAiMessages(input),
    });

    if (generation.kind === "failure") {
      throw new Error(generation.userSafeMessage);
    }

    return createCurriculumSourceFromAiDraftArtifact({
      householdId: input.organizationId,
      artifact: generation.artifact,
      sourceMetadata: input.curriculumSourceMetadata,
    });
  }

  const imported: ImportedCurriculumDocument =
    input.curriculumMode === "paste_outline"
      ? buildStructuredDocumentFromOutline(input)
      : buildStarterDocument(input);

  return importStructuredCurriculumDocument({
    householdId: input.organizationId,
    imported,
  });
}

function extractDetectedChunks(sourceInput: string) {
  const trimmedLines = sourceInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  return trimmedLines.length > 0 ? trimmedLines : [sourceInput.trim().slice(0, 80)];
}

function inferDefaultHorizon(input: {
  intakeRoute: FastPathIntakeRoute;
  sourceInput: string;
  horizonIntent?: "today_only" | "auto";
}): {
  inferredHorizon: CurriculumGenerationHorizon;
  decisionSource: CurriculumHorizonDecisionSource;
} {
  if (input.horizonIntent === "today_only") {
    return {
      inferredHorizon: "today",
      decisionSource: "user_selected",
    };
  }

  const sourceLength = input.sourceInput.trim().length;
  switch (input.intakeRoute) {
    case "single_lesson":
      return {
        inferredHorizon: sourceLength > 180 ? "tomorrow" : "today",
        decisionSource: "system_default",
      };
    case "weekly_plan":
      return {
        inferredHorizon: "current_week",
        decisionSource: "system_default",
      };
    case "outline":
      return {
        inferredHorizon: sourceLength > 260 ? "current_week" : "next_few_days",
        decisionSource: "system_default",
      };
    case "topic":
      return {
        inferredHorizon: "starter_module",
        decisionSource: "system_default",
      };
    case "manual_shell":
      return {
        inferredHorizon: "starter_week",
        decisionSource: "system_default",
      };
  }
}

function estimateConfidence(input: {
  intakeRoute: FastPathIntakeRoute;
  sourceInput: string;
  horizonIntent?: "today_only" | "auto";
}): CurriculumIntakeConfidence {
  const sourceLength = input.sourceInput.trim().length;
  const lines = input.sourceInput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const numberedMarkers = lines.filter((line) => /^(\d+[.)]|[-*+])\s+/.test(line)).length;

  switch (input.intakeRoute) {
    case "single_lesson":
      if (sourceLength >= 160) {
        return "high";
      }
      return sourceLength >= 60 ? "medium" : "low";
    case "weekly_plan":
      if (numberedMarkers >= 3 || sourceLength >= 120) {
        return "high";
      }
      return sourceLength >= 60 ? "medium" : "low";
    case "outline":
      if (numberedMarkers >= 4 || lines.length >= 4) {
        return "high";
      }
      return sourceLength >= 80 ? "medium" : "low";
    case "topic":
      return sourceLength >= 80 ? "medium" : "low";
    case "manual_shell":
      return "low";
  }
}

function buildAssumptions(params: {
  intakeRoute: FastPathIntakeRoute;
  chosenHorizon: CurriculumGenerationHorizon;
  confidence: CurriculumIntakeConfidence;
}) {
  const assumptions = [
    params.chosenHorizon === "today"
      ? "We will keep the first plan bounded to today."
      : params.chosenHorizon === "current_week"
        ? "We will plan against the current week, not a longer curriculum arc."
        : `We will start with ${params.chosenHorizon.replaceAll("_", " ")}.`,
  ];

  if (params.intakeRoute === "outline") {
    assumptions.push("We are treating this as a sequence outline, not a complete curriculum import.");
  }
  if (params.intakeRoute === "topic") {
    assumptions.push("We are treating this as a starter module, not a full course.");
  }
  if (params.confidence === "low") {
    assumptions.push("Some source details are ambiguous, so the plan will stay conservative until you confirm.");
  }

  return assumptions;
}

function buildPreviewTitle(input: {
  intakeRoute: FastPathIntakeRoute;
  sourceInput: string;
}) {
  const prefix =
    input.intakeRoute === "topic"
      ? "Topic starter"
      : input.intakeRoute === "weekly_plan"
        ? "Week plan"
        : input.intakeRoute === "outline"
          ? "Outline plan"
          : input.intakeRoute === "manual_shell"
            ? "Starter shell"
            : "Lesson plan";

  return `${prefix}: ${input.sourceInput.trim().slice(0, 48)}`;
}

async function resolveFastPathSource(params: Pick<
  HomeschoolFastPathOnboardingInput,
  "sourceInput" | "sourcePackageId"
>) {
  if (params.sourcePackageId) {
    const sourcePackage = await getNormalizedIntakeSourcePackage(params.sourcePackageId);
    const normalizedText = sourcePackage.normalizedText.trim();

    if (!normalizedText) {
      throw new Error("The selected source package did not produce usable text.");
    }

    return {
      sourceInput: normalizedText,
      sourcePackage,
      assetIds: sourcePackage.assets.map((asset) => asset.id),
    };
  }

  const sourceInput = params.sourceInput?.trim() ?? "";
  if (!sourceInput) {
    throw new Error("Source input is required.");
  }

  return {
    sourceInput,
    sourcePackage: null,
    assetIds: [],
  };
}

function buildFastPathPreview(
  input: {
    learnerName: string;
    intakeRoute: FastPathIntakeRoute;
    sourceInput: string;
    horizonIntent?: "today_only" | "auto";
  },
  corrections?: HomeschoolFastPathOnboardingInput["previewCorrections"],
): HomeschoolFastPathPreview {
  const detectedChunks = extractDetectedChunks(input.sourceInput);
  const confidence = estimateConfidence(input);
  const { inferredHorizon, decisionSource } = inferDefaultHorizon(input);
  const chosenHorizon = corrections?.chosenHorizon ?? inferredHorizon;

  return {
    learnerTarget: corrections?.learnerName?.trim() || input.learnerName.trim(),
    intakeRoute: corrections?.intakeRoute ?? input.intakeRoute,
    title: corrections?.title?.trim() || buildPreviewTitle(input),
    detectedChunks,
    assumptions: buildAssumptions({
      intakeRoute: corrections?.intakeRoute ?? input.intakeRoute,
      chosenHorizon,
      confidence,
    }),
    inferredHorizon,
    chosenHorizon,
    horizonDecisionSource: corrections?.chosenHorizon ? "user_corrected_in_preview" : decisionSource,
    confidence,
  };
}

async function markOnboardingMilestone(params: {
  organizationId: string;
  milestone: OnboardingMilestone;
  patch?: Record<string, unknown>;
}) {
  const organization = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, params.organizationId),
  });
  if (!organization) {
    return;
  }
  const metadata = asRecord(organization.metadata);
  const homeschool = asRecord(metadata.homeschool);
  const onboarding = asRecord(homeschool.onboarding);
  const milestones = mergeMilestone(toMilestoneList(onboarding.milestones), params.milestone);

  await getDb()
    .update(organizations)
    .set({
      metadata: {
        ...metadata,
        homeschool: {
          ...homeschool,
          onboarding: {
            ...onboarding,
            ...params.patch,
            milestones,
            currentMilestone: params.milestone,
          },
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, params.organizationId));
}

export async function runHomeschoolFastPathOnboarding(rawInput: HomeschoolFastPathOnboardingInput) {
  const input = HomeschoolFastPathOnboardingSchema.parse(rawInput);
  const resolvedSource = await resolveFastPathSource(input);
  await markOnboardingMilestone({
    organizationId: input.organizationId,
    milestone: "fast_path_started",
    patch: { status: "in_progress", completedAt: null },
  });
  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.onboardingStarted,
    organizationId: input.organizationId,
  });
  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.learnerNameSubmitted,
    organizationId: input.organizationId,
    metadata: { learnerNameLength: input.learnerName.length },
  });
  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.intakeTypeSelected,
    organizationId: input.organizationId,
    metadata: { intakeRoute: input.intakeRoute, horizonIntent: input.horizonIntent ?? "auto" },
  });
  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.intakeSourceSubmitted,
    organizationId: input.organizationId,
    metadata: {
      sourceLength: resolvedSource.sourceInput.length,
      sourcePackageId: resolvedSource.sourcePackage?.id ?? null,
      sourceModality: resolvedSource.sourcePackage?.modality ?? "text",
      assetCount: resolvedSource.assetIds.length,
    },
  });

  const preview = buildFastPathPreview(
    {
      ...input,
      sourceInput: resolvedSource.sourceInput,
    },
    input.previewCorrections,
  );
  if ((preview.confidence === "low" || preview.confidence === "medium") && !input.confirmPreview) {
    return {
      mode: "preview_required" as const,
      preview,
    };
  }

  const curriculumMode =
    preview.intakeRoute === "topic" || preview.intakeRoute === "manual_shell"
      ? "manual_shell"
      : preview.intakeRoute === "outline"
        ? "paste_outline"
        : "ai_decompose";
  const learnerInput = {
    displayName: preview.learnerTarget,
    pacePreference: "balanced" as const,
    loadPreference: "balanced" as const,
  };
  const sourceInput = resolvedSource.sourceInput;
  const setupInput: HomeschoolOnboardingPayload = {
    organizationId: input.organizationId,
    householdName: "Homeschool Household",
    preferredSchoolDays: [...homeschoolTemplate.defaults.schoolDays],
    dailyTimeBudgetMinutes: homeschoolTemplate.defaults.dailyTimeBudgetMinutes,
    subjects: ["Integrated Studies"],
    learners: [learnerInput],
    curriculumMode,
    curriculumTitle: preview.title,
    curriculumSummary: `Fast-path intake (${preview.intakeRoute.replaceAll("_", " ")})${
      resolvedSource.sourcePackage ? ` · ${resolvedSource.sourcePackage.modality}` : ""
    }`,
    curriculumText: sourceInput,
    curriculumSourceMetadata: {
      intake: {
        route: preview.intakeRoute,
        routeVersion: 1,
        rawText: sourceInput,
        assetIds: resolvedSource.assetIds,
        learnerId: null,
        confidence: preview.confidence,
        inferredHorizon: preview.inferredHorizon,
        chosenHorizon: preview.chosenHorizon,
        horizonDecisionSource: preview.horizonDecisionSource,
        assumptions: preview.assumptions,
        detectedChunks: preview.detectedChunks,
        sourcePackageId: resolvedSource.sourcePackage?.id ?? null,
        sourceModality: resolvedSource.sourcePackage?.modality ?? "text",
        createdFrom: "onboarding_fast_path",
      },
    },
  };

  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.generationStarted,
    organizationId: input.organizationId,
    metadata: { intakeRoute: preview.intakeRoute, chosenHorizon: preview.chosenHorizon },
  });

  const { primaryLearner } = await persistHomeschoolSetupBase(setupInput);
  const curriculum = await initializeCurriculum(setupInput, primaryLearner);
  const sourceId = "sourceId" in curriculum ? curriculum.sourceId : curriculum.id;
  await setLiveCurriculumSource(input.organizationId, sourceId);

  const { weekStartDate } = await getOrCreateWeeklyRouteBoardForLearner({
    learnerId: primaryLearner.id,
    sourceId,
  });
  await getTodayWorkspace({
    organizationId: input.organizationId,
    learnerId: primaryLearner.id,
    learnerName: primaryLearner.displayName,
    date: new Date().toISOString().slice(0, 10),
  });

  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.generationCompleted,
    organizationId: input.organizationId,
    learnerId: primaryLearner.id,
    metadata: { sourceId, weekStartDate },
  });
  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.firstTodayOpened,
    organizationId: input.organizationId,
    learnerId: primaryLearner.id,
  });

  await markOnboardingMilestone({
    organizationId: input.organizationId,
    milestone: "first_day_ready",
    patch: {
      status: "complete",
      completedAt: new Date().toISOString(),
      firstReadyAt: new Date().toISOString(),
      intake: {
        route: preview.intakeRoute,
        sourceInput,
        sourcePackageId: resolvedSource.sourcePackage?.id ?? null,
        sourceModality: resolvedSource.sourcePackage?.modality ?? "text",
        confidence: preview.confidence,
        inferredHorizon: preview.inferredHorizon,
        chosenHorizon: preview.chosenHorizon,
        horizonDecisionSource: preview.horizonDecisionSource,
      },
    },
  });

  await recordHomeschoolAuditEvent({
    organizationId: input.organizationId,
    learnerId: primaryLearner.id,
    entityType: "onboarding",
    eventType: "onboarding.fast_path_completed",
    summary: `Completed fast-path onboarding for ${primaryLearner.displayName}.`,
    metadata: {
      intakeRoute: preview.intakeRoute,
      confidence: preview.confidence,
      chosenHorizon: preview.chosenHorizon,
    },
  });

  return {
    mode: "completed" as const,
    learnerId: primaryLearner.id,
    sourceId,
    weekStartDate,
    redirectTo: "/today",
    preview,
  };
}

export async function completeHomeschoolOnboarding(rawInput: unknown) {
  const { input, primaryLearner } = await prepareHomeschoolOnboarding(rawInput);

  const curriculum = await initializeCurriculum(
    input,
    primaryLearner,
  );

  const sourceId = "sourceId" in curriculum ? curriculum.sourceId : curriculum.id;
  await setLiveCurriculumSource(input.organizationId, sourceId);

  const { weekStartDate } = await getOrCreateWeeklyRouteBoardForLearner({
    learnerId: primaryLearner.id,
    sourceId,
  });

  await getTodayWorkspace({
    organizationId: input.organizationId,
    learnerId: primaryLearner.id,
    learnerName: primaryLearner.displayName,
    date: new Date().toISOString().slice(0, 10),
  });

  const organization = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, input.organizationId),
  });
  if (organization) {
    const metadata = asRecord(organization.metadata);
    const homeschool = asRecord(metadata.homeschool);
    const onboarding = asRecord(homeschool.onboarding);

    await getDb()
      .update(organizations)
      .set({
        metadata: {
          ...metadata,
          homeschool: {
            ...homeschool,
            onboarding: {
              ...onboarding,
              status: "complete",
              completedAt: new Date().toISOString(),
              milestones: ["fast_path_started", "first_day_ready", "household_defaults_completed", "week_ready"],
              currentMilestone: "week_ready",
            },
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, input.organizationId));
  }

  await recordHomeschoolAuditEvent({
    organizationId: input.organizationId,
    learnerId: primaryLearner.id,
    entityType: "onboarding",
    eventType: "onboarding.completed",
    summary: `Completed homeschool onboarding for ${input.householdName}.`,
    metadata: {
      learnerCount: input.learners.length,
      curriculumMode: input.curriculumMode,
      subjects: normalizeSubjects(input.subjects),
    },
  });
  await trackProductEvent({
    name: "homeschool_onboarding_completed",
    organizationId: input.organizationId,
    learnerId: primaryLearner.id,
    metadata: {
      learnerCount: input.learners.length,
      curriculumMode: input.curriculumMode,
    },
  });

  return {
    learnerId: primaryLearner.id,
    sourceId,
    weekStartDate,
    plannerPolicy: homeschoolTemplate.plannerPolicy,
    redirectTo: "/today",
  };
}
