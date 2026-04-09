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
import { trackProductEvent } from "@/lib/platform/observability";

import type { HomeschoolOnboardingInput } from "@/lib/homeschool/onboarding/types";

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
      lineage: {
        mode: "manual_shell",
        createdFromOnboarding: true,
      },
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
      lineage: {
        mode: "paste_outline",
        createdFromOnboarding: true,
        rawTextLength: (input.curriculumText ?? "").length,
      },
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

  return {
    isComplete: typeof onboarding.completedAt === "string",
    completedAt: typeof onboarding.completedAt === "string" ? onboarding.completedAt : null,
  };
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
  trackProductEvent({
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
