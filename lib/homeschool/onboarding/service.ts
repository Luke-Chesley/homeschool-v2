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
import {
  buildTodayLessonDraftFingerprint,
  getTodayWorkspace,
  queueTodayLessonBuild,
} from "@/lib/planning/today-service";
import {
  collapseWeeklyRouteToTodayWindow,
  getOrCreateWeeklyRouteBoardForLearner,
} from "@/lib/planning/weekly-route-service";
import { recordHomeschoolAuditEvent } from "@/lib/homeschool/reporting/service";
import {
  ACTIVATION_EVENT_NAMES,
  ONBOARDING_MILESTONES,
  type OnboardingMilestone,
} from "@/lib/homeschool/onboarding/activation-contracts";
import { createFastPathBoundedCurriculum } from "@/lib/homeschool/onboarding/bounded-plan";
import { getNormalizedIntakeSourcePackage } from "@/lib/homeschool/intake/service";
import { executeSourceInterpret } from "@/lib/learning-core/source-interpret";
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
  SourceInterpretSourceKind,
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

function getFastPathIntakeMetadata(input: HomeschoolOnboardingInput) {
  const metadata = asRecord(input.curriculumSourceMetadata);
  const intake = asRecord(metadata.intake);
  const detectedChunks = Array.isArray(intake.detectedChunks)
    ? intake.detectedChunks.filter((entry): entry is string => typeof entry === "string")
    : [];
  const chosenHorizonParse =
    typeof intake.chosenHorizon === "string"
      ? CurriculumGenerationHorizonSchema.safeParse(intake.chosenHorizon)
      : null;
  const chosenHorizon = chosenHorizonParse?.success ? chosenHorizonParse.data : null;
  const sourceKind =
    typeof intake.sourceKind === "string" ? intake.sourceKind : null;

  return {
    detectedChunks,
    chosenHorizon,
    sourceKind,
  };
}

function lessonCountForHorizon(horizon: CurriculumGenerationHorizon | null) {
  switch (horizon) {
    case "today":
      return 1;
    case "tomorrow":
      return 2;
    case "next_few_days":
      return 3;
    case "current_week":
      return 5;
    case "starter_module":
      return 4;
    case "starter_week":
      return 5;
    default:
      return 3;
  }
}

function buildStarterLessonsFromChunks(params: {
  title: string;
  subject: string;
  chunks: string[];
  horizon: CurriculumGenerationHorizon | null;
  dailyTimeBudgetMinutes: number;
}) {
  const lessons = params.chunks
    .slice(0, lessonCountForHorizon(params.horizon))
    .map((chunk, index) => ({
      title: chunk,
      description:
        index === 0
          ? `Start with ${chunk}.`
          : `Carry the plan forward with ${chunk}.`,
      subject: params.subject,
      estimatedMinutes: Math.max(20, Math.round(params.dailyTimeBudgetMinutes)),
      materials: [],
      objectives: [chunk],
      linkedSkillTitles: [],
    }));

  if (lessons.length > 0) {
    return lessons;
  }

  return [
    {
      title: params.title,
      description: `Start a bounded plan for ${params.title}.`,
      subject: params.subject,
      estimatedMinutes: Math.max(20, Math.round(params.dailyTimeBudgetMinutes)),
      materials: [],
      objectives: [],
      linkedSkillTitles: [],
    },
  ];
}

function buildStarterDocument(input: HomeschoolOnboardingInput) {
  const lessonsPerSubject = ["Warm-up", "Core lesson", "Review and evidence"];
  const intake = getFastPathIntakeMetadata(input);
  const useSourceAwareShell = intake.detectedChunks.length > 0;

  if (useSourceAwareShell) {
    const subject = input.subjects[0] ?? "Integrated Studies";
    const lessons = buildStarterLessonsFromChunks({
      title: input.curriculumTitle,
      subject,
      chunks: intake.detectedChunks,
      horizon: intake.chosenHorizon,
      dailyTimeBudgetMinutes: Math.max(
        20,
        Math.round(input.dailyTimeBudgetMinutes / Math.max(input.subjects.length, 1)),
      ),
    });

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
      document: {
        [subject]: {
          [input.curriculumTitle]: lessons.map((lesson) => lesson.title),
        },
      },
      units: [
        {
          title: input.curriculumTitle,
          description:
            intake.sourceKind === "topic_seed"
              ? `Starter module seeded from ${input.curriculumTitle}.`
              : `Starter sequence derived from fast-path intake.`,
          estimatedSessions: lessons.length,
          lessons,
        },
      ],
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

function sourceKindToRoute(sourceKind: SourceInterpretSourceKind): FastPathIntakeRoute {
  switch (sourceKind) {
    case "single_day_material":
      return "single_lesson";
    case "weekly_assignments":
      return "weekly_plan";
    case "sequence_outline":
      return "outline";
    case "topic_seed":
      return "topic";
    case "manual_shell":
    case "ambiguous":
      return "manual_shell";
  }
}

function routeToCurriculumMode(intakeRoute: FastPathIntakeRoute) {
  switch (intakeRoute) {
    case "weekly_plan":
    case "outline":
      return "paste_outline" as const;
    case "single_lesson":
    case "topic":
    case "manual_shell":
      return "manual_shell" as const;
  }
}

const HORIZON_RANK: Record<CurriculumGenerationHorizon, number> = {
  today: 1,
  tomorrow: 2,
  next_few_days: 3,
  current_week: 4,
  starter_module: 5,
  starter_week: 6,
};

const HORIZON_BY_RANK: Record<number, CurriculumGenerationHorizon> = {
  1: "today",
  2: "tomorrow",
  3: "next_few_days",
  4: "current_week",
  5: "starter_module",
  6: "starter_week",
};

function maxHorizonRankForRoute(intakeRoute: FastPathIntakeRoute) {
  switch (intakeRoute) {
    case "single_lesson":
      return 2;
    case "weekly_plan":
    case "outline":
      return 4;
    case "topic":
      return 5;
    case "manual_shell":
      return 6;
  }
}

function maxHorizonRankForSourceKind(sourceKind: SourceInterpretSourceKind) {
  switch (sourceKind) {
    case "single_day_material":
      return 2;
    case "weekly_assignments":
    case "sequence_outline":
      return 4;
    case "topic_seed":
      return 5;
    case "manual_shell":
      return 6;
    case "ambiguous":
      return 1;
  }
}

function clampHorizon(params: {
  sourceKind: SourceInterpretSourceKind;
  intakeRoute: FastPathIntakeRoute;
  requestedHorizon: CurriculumGenerationHorizon;
}) {
  const maxRank = Math.min(
    maxHorizonRankForRoute(params.intakeRoute),
    maxHorizonRankForSourceKind(params.sourceKind),
  );
  const requestedRank = HORIZON_RANK[params.requestedHorizon];

  if (requestedRank <= maxRank) {
    return params.requestedHorizon;
  }

  return HORIZON_BY_RANK[maxRank];
}

function buildFastPathPreview(
  input: {
    learnerName: string;
    intakeRoute: FastPathIntakeRoute;
    sourceInput: string;
    horizonIntent?: "today_only" | "auto";
    interpretation: {
      sourceKind: SourceInterpretSourceKind;
      suggestedTitle: string;
      confidence: CurriculumIntakeConfidence;
      recommendedHorizon: CurriculumGenerationHorizon;
      assumptions: string[];
      detectedChunks: string[];
      followUpQuestion?: string | null;
      needsConfirmation: boolean;
    };
  },
  corrections?: HomeschoolFastPathOnboardingInput["previewCorrections"],
): HomeschoolFastPathPreview {
  const routedByPolicy = sourceKindToRoute(input.interpretation.sourceKind);
  const requestedRoute = input.intakeRoute;
  const inferredRoute = corrections?.intakeRoute ?? routedByPolicy;
  const inferredHorizonCandidate =
    input.horizonIntent === "today_only" ? "today" : input.interpretation.recommendedHorizon;
  const inferredHorizon = clampHorizon({
    sourceKind: input.interpretation.sourceKind,
    intakeRoute: routedByPolicy,
    requestedHorizon: inferredHorizonCandidate,
  });
  const inferredDecisionSource: CurriculumHorizonDecisionSource =
    input.horizonIntent === "today_only"
      ? "user_selected"
      : inferredHorizon !== input.interpretation.recommendedHorizon
        ? "confidence_limited"
        : "system_default";
  const requestedChosenHorizon = corrections?.chosenHorizon ?? inferredHorizon;
  const chosenHorizon = clampHorizon({
    sourceKind: input.interpretation.sourceKind,
    intakeRoute: inferredRoute,
    requestedHorizon: requestedChosenHorizon,
  });
  const decisionSource: CurriculumHorizonDecisionSource =
    corrections?.chosenHorizon
      ? chosenHorizon === corrections.chosenHorizon
        ? "user_corrected_in_preview"
        : "confidence_limited"
      : inferredDecisionSource;
  const detectedChunks =
    input.interpretation.detectedChunks.length > 0
      ? input.interpretation.detectedChunks
      : extractDetectedChunks(input.sourceInput);
  const assumptions = [...input.interpretation.assumptions];

  if (routedByPolicy !== requestedRoute) {
    assumptions.push(
      `We are routing this as ${routedByPolicy.replaceAll("_", " ")} instead of ${requestedRoute.replaceAll("_", " ")}.`,
    );
  }

  if (chosenHorizon !== requestedChosenHorizon) {
    assumptions.push("We kept the first plan conservative so the source does not overpromise scope.");
  }

  return {
    learnerTarget: corrections?.learnerName?.trim() || input.learnerName.trim(),
    requestedRoute,
    intakeRoute: inferredRoute,
    sourceKind: input.interpretation.sourceKind,
    title:
      corrections?.title?.trim() ||
      input.interpretation.suggestedTitle ||
      buildPreviewTitle({ intakeRoute: inferredRoute, sourceInput: input.sourceInput }),
    detectedChunks,
    assumptions: assumptions.length > 0 ? assumptions : ["We will keep the first plan bounded."],
    inferredHorizon,
    chosenHorizon,
    horizonDecisionSource: decisionSource,
    confidence: input.interpretation.confidence,
    followUpQuestion: input.interpretation.followUpQuestion ?? null,
    needsConfirmation:
      input.interpretation.needsConfirmation ||
      input.interpretation.confidence !== "high" ||
      input.interpretation.sourceKind === "ambiguous" ||
      routedByPolicy !== requestedRoute ||
      Boolean(input.interpretation.followUpQuestion),
  };
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

  const sourceInterpretResult = await executeSourceInterpret({
    input: {
      learnerName: input.learnerName,
      requestedRoute: input.intakeRoute,
      inputModalities: [resolvedSource.sourcePackage?.modality ?? "text"],
      rawText: input.sourceInput?.trim() ?? resolvedSource.sourceInput,
      extractedText: resolvedSource.sourceInput,
      extractedStructure: resolvedSource.sourcePackage
        ? {
            summary: resolvedSource.sourcePackage.summary,
            detectedChunks: resolvedSource.sourcePackage.detectedChunks,
            extractionStatus: resolvedSource.sourcePackage.extractionStatus,
          }
        : {
            detectedChunks: extractDetectedChunks(resolvedSource.sourceInput),
          },
      assetRefs: resolvedSource.assetIds,
      userHorizonIntent: input.horizonIntent ?? "auto",
      titleCandidate: resolvedSource.sourcePackage?.title ?? null,
    },
    surface: "onboarding",
    organizationId: input.organizationId,
    workflowMode: "fast_path",
  });

  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.sourceInterpreted,
    organizationId: input.organizationId,
    metadata: {
      requestedRoute: input.intakeRoute,
      sourceKind: sourceInterpretResult.artifact.sourceKind,
      confidence: sourceInterpretResult.artifact.confidence,
      recommendedHorizon: sourceInterpretResult.artifact.recommendedHorizon,
      needsConfirmation: sourceInterpretResult.artifact.needsConfirmation,
    },
  });

  const preview = buildFastPathPreview(
    {
      sourceInput: resolvedSource.sourceInput,
      learnerName: input.learnerName,
      intakeRoute: input.intakeRoute,
      horizonIntent: input.horizonIntent,
      interpretation: sourceInterpretResult.artifact,
    },
    input.previewCorrections,
  );
  if (preview.needsConfirmation && !input.confirmPreview) {
    return {
      mode: "preview_required" as const,
      preview,
    };
  }

  const curriculumMode = routeToCurriculumMode(preview.intakeRoute);
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
    curriculumSourceMetadata: {},
  };
  const intakeMetadata = {
    route: preview.intakeRoute,
    requestedRoute: preview.requestedRoute,
    routeVersion: 1,
    rawText: sourceInput,
    assetIds: resolvedSource.assetIds,
    learnerId: null,
    confidence: preview.confidence,
    sourceKind: preview.sourceKind,
    inferredHorizon: preview.inferredHorizon,
    chosenHorizon: preview.chosenHorizon,
    horizonDecisionSource: preview.horizonDecisionSource,
    assumptions: preview.assumptions,
    detectedChunks: preview.detectedChunks,
    followUpQuestion: preview.followUpQuestion ?? null,
    needsConfirmation: preview.needsConfirmation,
    sourcePackageId: resolvedSource.sourcePackage?.id ?? null,
    sourceModality: resolvedSource.sourcePackage?.modality ?? "text",
    learningCoreLineage: sourceInterpretResult.lineage,
    curriculumMode,
    createdFrom: "onboarding_fast_path" as const,
  };

  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.generationStarted,
    organizationId: input.organizationId,
    metadata: {
      intakeRoute: preview.intakeRoute,
      requestedRoute: preview.requestedRoute,
      sourceKind: preview.sourceKind,
      chosenHorizon: preview.chosenHorizon,
      curriculumMode,
    },
  });

  const { primaryLearner } = await persistHomeschoolSetupBase(setupInput);
  const boundedCurriculum = await createFastPathBoundedCurriculum({
    organizationId: input.organizationId,
    learnerName: preview.learnerTarget,
    sourceText: sourceInput,
    preview,
    intakeMetadata,
  });
  const curriculum = boundedCurriculum.curriculum;
  const sourceId = curriculum.id;
  await setLiveCurriculumSource(input.organizationId, sourceId);

  const { weekStartDate } = await getOrCreateWeeklyRouteBoardForLearner({
    learnerId: primaryLearner.id,
    sourceId,
  });
  const todayDate = new Date().toISOString().slice(0, 10);
  await collapseWeeklyRouteToTodayWindow({
    learnerId: primaryLearner.id,
    sourceId,
    date: todayDate,
  });
  const todayWorkspace = await getTodayWorkspace({
    organizationId: input.organizationId,
    learnerId: primaryLearner.id,
    learnerName: primaryLearner.displayName,
    date: todayDate,
  });
  if (todayWorkspace?.workspace.items.length) {
    await queueTodayLessonBuild({
      organizationId: input.organizationId,
      learnerId: primaryLearner.id,
      date: todayDate,
      sourceId,
      routeFingerprint: buildTodayLessonDraftFingerprint(
        todayWorkspace.workspace.items.map((item) => item.id),
      ),
      trigger: "onboarding_auto",
    });
    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.todayLessonBuildQueued,
      organizationId: input.organizationId,
      learnerId: primaryLearner.id,
      metadata: {
        sourceId,
        date: todayDate,
        itemCount: todayWorkspace.workspace.items.length,
        sourceKind: preview.sourceKind,
        chosenHorizon: preview.chosenHorizon,
      },
    });
  }

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
        requestedRoute: preview.requestedRoute,
        sourceInput,
        sourcePackageId: resolvedSource.sourcePackage?.id ?? null,
        sourceModality: resolvedSource.sourcePackage?.modality ?? "text",
        confidence: preview.confidence,
        sourceKind: preview.sourceKind,
        inferredHorizon: preview.inferredHorizon,
        chosenHorizon: preview.chosenHorizon,
        horizonDecisionSource: preview.horizonDecisionSource,
        followUpQuestion: preview.followUpQuestion ?? null,
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
      requestedRoute: preview.requestedRoute,
      sourceKind: preview.sourceKind,
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

  const todayDate = new Date().toISOString().slice(0, 10);
  const todayWorkspace = await getTodayWorkspace({
    organizationId: input.organizationId,
    learnerId: primaryLearner.id,
    learnerName: primaryLearner.displayName,
    date: todayDate,
  });
  if (todayWorkspace?.workspace.items.length) {
    await queueTodayLessonBuild({
      organizationId: input.organizationId,
      learnerId: primaryLearner.id,
      date: todayDate,
      sourceId,
      routeFingerprint: buildTodayLessonDraftFingerprint(
        todayWorkspace.workspace.items.map((item) => item.id),
      ),
      trigger: "onboarding_auto",
    });
    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.todayLessonBuildQueued,
      organizationId: input.organizationId,
      learnerId: primaryLearner.id,
      metadata: {
        sourceId,
        date: todayDate,
        itemCount: todayWorkspace.workspace.items.length,
        curriculumMode: input.curriculumMode,
      },
    });
  }

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
