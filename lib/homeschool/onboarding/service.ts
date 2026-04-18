import "@/lib/server-only";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { homeschoolTemplate } from "@/config/templates/homeschool";
import { ensureComplianceProgramForLearner } from "@/lib/compliance/service";
import { setLiveCurriculumSource } from "@/lib/curriculum/service";
import { getDb } from "@/lib/db/server";
import {
  curriculumSources,
  learnerProfiles,
  learners,
  lessonSessions,
  organizationPlatformSettings,
  organizations,
  plans,
} from "@/lib/db/schema";
import {
  buildTodayLessonDraftFingerprint,
  getTodayWorkspace,
  queueTodayLessonBuild,
} from "@/lib/planning/today-service";
import {
  getOrCreateWeeklyRouteBoardForLearner,
} from "@/lib/planning/weekly-route-service";
import { recordHomeschoolAuditEvent } from "@/lib/homeschool/reporting/service";
import {
  ACTIVATION_EVENT_NAMES,
  ONBOARDING_MILESTONES,
  type OnboardingMilestone,
} from "@/lib/homeschool/onboarding/activation-contracts";
import {
  buildPersistedSourceModel,
  createCurriculumFromConversationIntake,
  createCurriculumFromSourceEntry,
  createFastPathCurriculumFromSource,
} from "@/lib/homeschool/onboarding/curriculum";
import {
  buildFastPathLaunchSummary,
  buildFastPathPreview,
  extractDetectedChunks,
  routeToCurriculumMode,
} from "@/lib/homeschool/onboarding/fast-path";
import {
  createLearningCoreInputFilesFromSourcePackages,
  getNormalizedIntakeSourcePackages,
  toIntakeSourcePackageContext,
} from "@/lib/homeschool/intake/service";
import type { IntakeSourcePackageModality } from "@/lib/homeschool/intake/types";
import { executeSourceInterpret } from "@/lib/learning-core/source-interpret";
import { trackProductEvent } from "@/lib/platform/observability";

import {
  FAST_PATH_INTAKE_ROUTES,
} from "@/lib/homeschool/onboarding/types";
import type {
  FastPathIntakeRoute,
  HomeschoolFastPathOnboardingInput,
  HomeschoolOnboardingInput,
  HomeschoolOnboardingStatus,
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
  sourcePackageIds: z.array(z.string().trim().min(1)).max(8).optional(),
  curriculumSourceMetadata: z.record(z.string(), z.unknown()).optional(),
});

const RawHomeschoolCurriculumIntakeSchema = z.object({
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
  sourcePackageIds: z.array(z.string().trim().min(1)).max(8).optional(),
});

export const HomeschoolCurriculumIntakeSchema = RawHomeschoolCurriculumIntakeSchema.superRefine(
  (input, ctx) => {
    if (
      input.curriculumMode !== "manual_shell" &&
      !input.curriculumText?.trim() &&
      normalizeSourcePackageIds(input).length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paste source material or upload a source package.",
        path: ["curriculumText"],
      });
    }
  },
).transform((input) => ({
  ...input,
  sourcePackageIds: normalizeSourcePackageIds(input),
}));

export type HomeschoolOnboardingPayload = z.infer<typeof HomeschoolOnboardingSchema>;
export type HomeschoolCurriculumIntakePayload = z.infer<typeof HomeschoolCurriculumIntakeSchema>;

const FastPathIntakeRouteInputSchema = z.enum(FAST_PATH_INTAKE_ROUTES);
const DEFAULT_FAST_PATH_INTAKE_ROUTE: FastPathIntakeRoute = "single_lesson";

function normalizeSourcePackageIds(input: {
  sourcePackageIds?: string[];
}) {
  return [
    ...new Set(
      (input.sourcePackageIds ?? [])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function combineResolvedSourceText(parts: string[]) {
  const combined: string[] = [];
  const seen = new Set<string>();

  for (const part of parts.map((value) => value.trim()).filter(Boolean)) {
    if (seen.has(part)) {
      continue;
    }
    seen.add(part);
    combined.push(part);
  }

  return combined.join("\n\n");
}

const RawHomeschoolFastPathOnboardingSchema = z.object({
  organizationId: z.string().min(1),
  learnerName: z.string().trim().min(1).max(80),
  intakeRoute: FastPathIntakeRouteInputSchema.optional(),
  sourceInput: z.string().trim().min(1).max(12000).optional(),
  sourcePackageIds: z.array(z.string().trim().min(1)).max(8).optional(),
  confirmPreview: z.boolean().optional(),
  previewCorrections: z
    .object({
      learnerName: z.string().trim().min(1).max(80).optional(),
      intakeRoute: FastPathIntakeRouteInputSchema.optional(),
      title: z.string().trim().min(1).max(160).optional(),
    })
    .optional(),
});

export const HomeschoolFastPathOnboardingSchema = RawHomeschoolFastPathOnboardingSchema.superRefine(
  (input, ctx) => {
    if (!input.sourceInput && normalizeSourcePackageIds(input).length === 0) {
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
  intakeRoute: input.intakeRoute ?? DEFAULT_FAST_PATH_INTAKE_ROUTE,
  intakeRouteExplicit: Boolean(input.intakeRoute),
  sourceInput: input.sourceInput,
  sourcePackageIds: normalizeSourcePackageIds(input),
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

function requestedRouteForCurriculumMode(
  curriculumMode: HomeschoolOnboardingInput["curriculumMode"],
): FastPathIntakeRoute {
  switch (curriculumMode) {
    case "paste_outline":
    case "ai_decompose":
      return "outline";
    case "manual_shell":
      return "manual_shell";
  }
}

function buildConversationCurriculumMessages(
  input: HomeschoolOnboardingInput,
): Array<{ role: "user" | "assistant"; content: string }> {
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
        `Preferred school days per week: ${input.preferredSchoolDays.length}`,
        `Daily time budget: ${input.dailyTimeBudgetMinutes} minutes`,
        input.teachingStyle ? `Teaching style: ${input.teachingStyle}` : null,
        input.curriculumSummary ? `Parent summary: ${input.curriculumSummary}` : null,
        `Requested title: ${input.curriculumTitle}`,
        input.curriculumMode === "manual_shell"
          ? "This is a conversation-intake curriculum request without a source-first interpretation step."
          : `Curriculum mode: ${input.curriculumMode}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export async function getHomeschoolOnboardingStatus(organizationId: string) {
  const db = getDb();
  const [organization, activeLearner, curriculumSource, plan, lessonSession] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    }),
    db.query.learners.findFirst({
      where: and(eq(learners.organizationId, organizationId), ne(learners.status, "archived")),
      columns: { id: true },
    }),
    db.query.curriculumSources.findFirst({
      where: and(
        eq(curriculumSources.organizationId, organizationId),
        ne(curriculumSources.status, "archived"),
      ),
      columns: { id: true },
    }),
    db.query.plans.findFirst({
      where: and(eq(plans.organizationId, organizationId), ne(plans.status, "archived")),
      columns: { id: true },
    }),
    db.query.lessonSessions.findFirst({
      where: eq(lessonSessions.organizationId, organizationId),
      columns: { id: true },
    }),
  ]);
  const metadata = asRecord(organization?.metadata);
  const homeschool = asRecord(metadata.homeschool);
  const onboarding = asRecord(homeschool.onboarding);
  const milestones = toMilestoneList(onboarding.milestones);
  const currentMilestone = milestones[milestones.length - 1] ?? null;
  const completedAt = typeof onboarding.completedAt === "string" ? onboarding.completedAt : null;
  const inferredLegacyCompletion =
    activeLearner !== undefined &&
    (curriculumSource !== undefined || plan !== undefined || lessonSession !== undefined);
  const isComplete =
    completedAt !== null ||
    milestones.includes("first_day_ready") ||
    milestones.includes("week_ready") ||
    inferredLegacyCompletion;

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
    sourcePackageIds: input.sourcePackageIds,
    schoolYearLabel: input.schoolYearLabel,
    teachingStyle: input.teachingStyle,
    curriculumSourceMetadata:
      input.sourcePackageIds.length > 0
        ? {
            createdFrom: "curriculum_add_flow",
            sourcePackageIds: input.sourcePackageIds,
          }
        : undefined,
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

  const sourceId = curriculum.curriculum.id;
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

  const createdLearners = await upsertLearnersForOnboarding(input.organizationId, input.learners, {
    schoolYearLabel: input.schoolYearLabel ?? null,
    startDate: input.termStartDate ?? null,
    endDate: input.termEndDate ?? null,
  });
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
  programDefaults: {
    schoolYearLabel: string | null;
    startDate: string | null;
    endDate: string | null;
  },
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

    await ensureComplianceProgramForLearner({
      organizationId,
      learnerId: learnerRecord.id,
      gradeLevel: learnerInput.gradeLevel ?? null,
      schoolYearLabel: programDefaults.schoolYearLabel,
      startDate: programDefaults.startDate,
      endDate: programDefaults.endDate,
      status: "active",
    });

    createdLearners.push(learnerRecord);
  }

  return createdLearners;
}

async function initializeCurriculum(input: HomeschoolOnboardingInput, learner: typeof learners.$inferSelect) {
  if (input.curriculumText?.trim() || (input.sourcePackageIds?.length ?? 0) > 0) {
    const resolvedSource = await resolveFastPathSource({
      sourceInput: input.curriculumText,
      sourcePackageIds: input.sourcePackageIds,
    });
    const sourceFiles = await createLearningCoreInputFilesFromSourcePackages(
      resolvedSource.sourcePackages,
    );
    const requestedRoute = requestedRouteForCurriculumMode(input.curriculumMode);
    const sourceInterpretResult = await executeSourceInterpret({
      input: {
        learnerName: learner.displayName,
        requestedRoute,
        inputModalities: resolvedSource.sourceModalities,
        rawText: resolvedSource.rawSourceInput ?? resolvedSource.sourceInput,
        extractedText: resolvedSource.sourceInput,
        extractedStructure:
          resolvedSource.sourcePackageContexts.length > 0
            ? {
                sourceCount: resolvedSource.sourcePackageContexts.length,
                packages: resolvedSource.sourcePackageContexts,
                detectedChunks: resolvedSource.sourcePackageContexts.flatMap(
                  (sourcePackage) => sourcePackage.detectedChunks,
                ),
              }
            : {
                detectedChunks: extractDetectedChunks(resolvedSource.sourceInput),
              },
        assetRefs: resolvedSource.assetIds,
        sourcePackages: resolvedSource.sourcePackageContexts,
        sourceFiles,
        titleCandidate: input.curriculumTitle,
      },
      surface: "curriculum",
      organizationId: input.organizationId,
      learnerId: learner.id,
      workflowMode: "curriculum_creation",
    });
    const routedRoute =
      sourceInterpretResult.artifact.sourceKind === "bounded_material"
        ? "single_lesson"
        : sourceInterpretResult.artifact.sourceKind === "timeboxed_plan"
          ? "weekly_plan"
          : sourceInterpretResult.artifact.sourceKind === "topic_seed"
            ? "topic"
            : sourceInterpretResult.artifact.sourceKind === "shell_request"
              || sourceInterpretResult.artifact.sourceKind === "ambiguous"
              ? "manual_shell"
              : "outline";

    return createCurriculumFromSourceEntry({
      organizationId: input.organizationId,
      learnerId: learner.id,
      learnerName: learner.displayName,
      titleCandidate: input.curriculumTitle,
      requestedRoute,
      routedRoute,
      sourceKind: sourceInterpretResult.artifact.sourceKind,
      entryStrategy: sourceInterpretResult.artifact.entryStrategy,
      entryLabel: sourceInterpretResult.artifact.entryLabel ?? null,
      continuationMode: sourceInterpretResult.artifact.continuationMode,
      deliveryPattern: sourceInterpretResult.artifact.deliveryPattern,
      recommendedHorizon: sourceInterpretResult.artifact.recommendedHorizon,
      sourceText: resolvedSource.sourceInput,
      sourcePackages: resolvedSource.sourcePackageContexts,
      sourceFiles,
      detectedChunks: sourceInterpretResult.artifact.detectedChunks,
      assumptions: sourceInterpretResult.artifact.assumptions,
      surface: "curriculum",
      workflowMode: "curriculum_creation",
      metadataBuilder: ({ artifact, lineage }) => ({
        ...(input.curriculumSourceMetadata ?? {}),
        intake: {
          route: requestedRoute,
          requestedRoute,
          routeVersion: 1,
          rawText: resolvedSource.sourceInput,
          assetIds: resolvedSource.assetIds,
          learnerId: learner.id,
          sourcePackageIds: resolvedSource.sourcePackageIds,
          sourcePackages: resolvedSource.sourcePackageContexts,
          sourceModalities: resolvedSource.sourceModalities,
          sourcePackageId: resolvedSource.sourcePackage?.id ?? null,
          sourceModality: resolvedSource.sourcePackage?.modality ?? "text",
          createdFrom:
            (input.curriculumSourceMetadata as Record<string, unknown> | undefined)
              ?.createdFrom ?? "curriculum_add_flow",
        },
        sourceModel: buildPersistedSourceModel({
          requestedRoute,
          routedRoute,
          confidence: sourceInterpretResult.artifact.confidence,
          sourceKind: sourceInterpretResult.artifact.sourceKind,
          entryStrategy: sourceInterpretResult.artifact.entryStrategy,
          entryLabel: sourceInterpretResult.artifact.entryLabel ?? null,
          continuationMode: sourceInterpretResult.artifact.continuationMode,
          deliveryPattern: sourceInterpretResult.artifact.deliveryPattern,
          recommendedHorizon: sourceInterpretResult.artifact.recommendedHorizon,
          assumptions: sourceInterpretResult.artifact.assumptions,
          detectedChunks: sourceInterpretResult.artifact.detectedChunks,
          followUpQuestion: sourceInterpretResult.artifact.followUpQuestion ?? null,
          needsConfirmation: sourceInterpretResult.artifact.needsConfirmation,
          sourcePackages: resolvedSource.sourcePackageContexts,
          sourcePackageIds: resolvedSource.sourcePackageIds,
          sourcePackageId: resolvedSource.sourcePackage?.id ?? null,
          sourceModalities: resolvedSource.sourceModalities,
          sourceModality: resolvedSource.sourcePackage?.modality ?? "text",
          lineage: sourceInterpretResult.lineage,
        }),
        launchPlan: artifact.launchPlan,
        curriculumLineage: {
          requestMode: "source_entry",
          sourceInterpret: sourceInterpretResult.lineage,
          curriculumGenerate: lineage,
        },
      }),
    });
  }

  return createCurriculumFromConversationIntake({
    organizationId: input.organizationId,
    learnerId: learner.id,
    learnerName: learner.displayName,
    titleCandidate: input.curriculumTitle,
    messages: buildConversationCurriculumMessages(input),
    requirementHints: {
      topic: input.curriculumTitle,
      goals: input.curriculumSummary ?? "",
      learnerProfile: input.learners
        .map((entry) =>
          [entry.displayName, entry.gradeLevel, entry.ageBand].filter(Boolean).join(" · "),
        )
        .join("\n"),
      constraints: input.teachingStyle ?? "",
      structurePreferences:
        input.curriculumMode === "manual_shell"
          ? "Start with a bounded starter curriculum."
          : "",
    },
    pacingExpectations: {
      sessionsPerWeek: input.preferredSchoolDays.length,
      sessionMinutes: input.dailyTimeBudgetMinutes,
    },
    granularityGuidance: [
      "Keep the opening lessons immediately teachable.",
      "Build a durable curriculum beyond the launch window.",
    ],
    correctionNotes: [],
    surface: "curriculum",
    workflowMode: "curriculum_creation",
    metadata: {
      ...(input.curriculumSourceMetadata ?? {}),
      intake: {
        route: requestedRouteForCurriculumMode(input.curriculumMode),
        requestedRoute: requestedRouteForCurriculumMode(input.curriculumMode),
        routeVersion: 1,
        learnerId: learner.id,
        createdFrom:
          (input.curriculumSourceMetadata as Record<string, unknown> | undefined)?.createdFrom ??
          "curriculum_add_flow",
      },
    },
    userAuthoredContext: {
      parentGoal: input.curriculumSummary ?? null,
      teacherNote: input.teachingStyle ?? null,
    },
  });
}

async function resolveFastPathSource(params: Pick<
  HomeschoolFastPathOnboardingInput,
  "sourceInput" | "sourcePackageIds"
>) {
  const packageIds = normalizeSourcePackageIds(params);
  const sourcePackages =
    packageIds.length > 0 ? await getNormalizedIntakeSourcePackages(packageIds) : [];

  for (const sourcePackage of sourcePackages) {
    if (!sourcePackage.normalizedText.trim()) {
      throw new Error("The selected source package did not produce usable text.");
    }
  }

  const rawSourceInput = params.sourceInput?.trim() ?? "";
  const sourceInput = combineResolvedSourceText([
    rawSourceInput,
    ...sourcePackages.map((sourcePackage) => sourcePackage.normalizedText),
  ]);
  if (!sourceInput) {
    throw new Error("Source input is required.");
  }

  const sourcePackageContexts = sourcePackages.map((sourcePackage) =>
    toIntakeSourcePackageContext(sourcePackage),
  );
  const sourceModalities = [
    ...new Set<IntakeSourcePackageModality>([
      ...(rawSourceInput ? (["text"] as IntakeSourcePackageModality[]) : []),
      ...sourcePackageContexts.map((sourcePackage) => sourcePackage.modality),
    ]),
  ];

  return {
    sourceInput,
    rawSourceInput: rawSourceInput || null,
    sourcePackage: sourcePackages[0] ?? null,
    sourcePackages,
    sourcePackageContexts,
    sourcePackageIds: sourcePackageContexts.map((sourcePackage) => sourcePackage.id),
    sourceModalities,
    assetIds: [
      ...new Set(
        sourcePackageContexts.flatMap((sourcePackage) => sourcePackage.assetIds),
      ),
    ],
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
  const sourceFiles = await createLearningCoreInputFilesFromSourcePackages(
    resolvedSource.sourcePackages,
  );
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
    metadata: {
      intakeRoute: input.intakeRoute,
      intakeRouteExplicit: input.intakeRouteExplicit ?? false,
    },
  });
  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.intakeSourceSubmitted,
    organizationId: input.organizationId,
    metadata: {
      sourceLength: resolvedSource.sourceInput.length,
      sourceCount:
        resolvedSource.sourcePackageContexts.length +
          (resolvedSource.rawSourceInput ? 1 : 0) || 1,
      sourcePackageIds: resolvedSource.sourcePackageIds,
      sourceModalities: resolvedSource.sourceModalities,
      sourceModality: resolvedSource.sourcePackage?.modality ?? "text",
      assetCount: resolvedSource.assetIds.length,
    },
  });

  const sourceInterpretResult = await executeSourceInterpret({
    input: {
      learnerName: input.learnerName,
      requestedRoute: input.intakeRoute,
      inputModalities: resolvedSource.sourceModalities,
      rawText: resolvedSource.rawSourceInput ?? resolvedSource.sourceInput,
      extractedText: resolvedSource.sourceInput,
      extractedStructure: resolvedSource.sourcePackageContexts.length > 0
        ? {
            sourceCount: resolvedSource.sourcePackageContexts.length,
            packages: resolvedSource.sourcePackageContexts,
            detectedChunks: resolvedSource.sourcePackageContexts.flatMap(
              (sourcePackage) => sourcePackage.detectedChunks,
            ),
          }
        : {
            detectedChunks: extractDetectedChunks(resolvedSource.sourceInput),
          },
      assetRefs: resolvedSource.assetIds,
      sourcePackages: resolvedSource.sourcePackageContexts,
      sourceFiles,
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
      entryStrategy: sourceInterpretResult.artifact.entryStrategy,
      entryLabel: sourceInterpretResult.artifact.entryLabel ?? null,
      continuationMode: sourceInterpretResult.artifact.continuationMode,
      confidence: sourceInterpretResult.artifact.confidence,
      recommendedHorizon: sourceInterpretResult.artifact.recommendedHorizon,
      needsConfirmation: sourceInterpretResult.artifact.needsConfirmation,
    },
  });

  const preview = buildFastPathPreview(
    {
      sourceInput: resolvedSource.sourceInput,
      sourcePackages: resolvedSource.sourcePackageContexts,
      learnerName: input.learnerName,
      intakeRoute: input.intakeRoute,
      intakeRouteExplicit: input.intakeRouteExplicit ?? false,
      interpretation: sourceInterpretResult.artifact,
      corrections: input.previewCorrections,
    },
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
      resolvedSource.sourcePackageContexts.length === 1
        ? ` · ${resolvedSource.sourcePackageContexts[0]!.modality}`
        : resolvedSource.sourcePackageContexts.length > 1
          ? ` · ${resolvedSource.sourcePackageContexts.length} sources`
          : ""
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
    sourcePackageIds: resolvedSource.sourcePackageIds,
    sourcePackages: resolvedSource.sourcePackageContexts,
    sourceModalities: resolvedSource.sourceModalities,
    sourcePackageId: resolvedSource.sourcePackage?.id ?? null,
    sourceModality: resolvedSource.sourcePackage?.modality ?? "text",
    createdFrom: "onboarding_fast_path" as const,
  };

  await trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.generationStarted,
    organizationId: input.organizationId,
    metadata: {
      intakeRoute: preview.intakeRoute,
      requestedRoute: preview.requestedRoute,
      sourceKind: preview.sourceKind,
      entryStrategy: preview.entryStrategy,
      entryLabel: preview.entryLabel ?? null,
      continuationMode: preview.continuationMode,
      chosenHorizon: preview.chosenHorizon,
      curriculumMode,
    },
  });

  const { primaryLearner } = await persistHomeschoolSetupBase(setupInput);
  const curriculumGeneration = await createFastPathCurriculumFromSource({
    organizationId: input.organizationId,
    learnerId: primaryLearner.id,
    learnerName: preview.learnerTarget,
    sourceText: sourceInput,
    sourcePackages: resolvedSource.sourcePackageContexts,
    sourceFiles,
    preview,
    intakeMetadata,
    sourceInterpretLineage: sourceInterpretResult.lineage,
  });
  const curriculum = curriculumGeneration.curriculum;
  const sourceId = curriculum.id;
  const launchSummary = buildFastPathLaunchSummary({
    preview,
    launchPlan: {
      chosenHorizon: curriculumGeneration.launchContext.recommendedHorizon,
      scopeSummary: curriculumGeneration.launchContext.scopeSummary ?? null,
      initialSliceUsed: curriculumGeneration.launchContext.initialSliceUsed,
      initialSliceLabel: curriculumGeneration.launchContext.initialSliceLabel ?? null,
      openingLessonRefs: curriculumGeneration.launchContext.openingLessonRefs,
    },
  });
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
        sourceKind: preview.sourceKind,
        chosenHorizon: preview.chosenHorizon,
        entryStrategy: preview.entryStrategy,
        entryLabel: preview.entryLabel ?? null,
        continuationMode: preview.continuationMode,
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
        sourcePackageIds: resolvedSource.sourcePackageIds,
        sourcePackages: resolvedSource.sourcePackageContexts,
        sourceModalities: resolvedSource.sourceModalities,
        sourcePackageId: resolvedSource.sourcePackage?.id ?? null,
        sourceModality: resolvedSource.sourcePackage?.modality ?? "text",
        confidence: preview.confidence,
        sourceKind: preview.sourceKind,
        entryStrategy: preview.entryStrategy,
        entryLabel: preview.entryLabel ?? null,
        continuationMode: preview.continuationMode,
        recommendedHorizon: preview.recommendedHorizon,
        chosenHorizon: preview.chosenHorizon,
        horizonDecisionSource: preview.horizonDecisionSource,
        followUpQuestion: preview.followUpQuestion ?? null,
        initialSliceUsed: curriculumGeneration.launchContext.initialSliceUsed,
        initialSliceLabel: curriculumGeneration.launchContext.initialSliceLabel,
        scopeSummary: curriculumGeneration.launchContext.scopeSummary,
        assumptions: preview.assumptions,
        detectedChunks: preview.detectedChunks,
        sourceModel: preview.sourceModel,
        launchPlan: curriculumGeneration.launchContext,
        curriculumLineage: {
          requestMode: "source_entry",
          sourceInterpret: sourceInterpretResult.lineage,
          curriculumGenerate: curriculumGeneration.lineage,
        },
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
      entryStrategy: preview.entryStrategy,
      entryLabel: preview.entryLabel ?? null,
      continuationMode: preview.continuationMode,
    },
  });

  return {
    mode: "completed" as const,
    learnerId: primaryLearner.id,
    sourceId,
    weekStartDate,
    redirectTo: "/today",
    preview,
    launchSummary,
  };
}

export async function completeHomeschoolOnboarding(rawInput: unknown) {
  const { input, primaryLearner } = await prepareHomeschoolOnboarding(rawInput);

  const curriculum = await initializeCurriculum(
    input,
    primaryLearner,
  );

  const sourceId = curriculum.curriculum.id;
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
