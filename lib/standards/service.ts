import "server-only";

import { and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import { standardFrameworks, standardNodes } from "@/lib/db/schema";
import { FRAMEWORKS, STANDARDS } from "./fixtures";
import type {
  StandardsFramework,
  Standard,
  CustomGoal,
  StandardsSearchParams,
  CreateCustomGoalInput,
} from "./types";

let seedPromise: Promise<void> | null = null;

function frameworkKindFromType(value: string) {
  switch (value) {
    case "competency_framework":
      return "competency";
    case "role_matrix":
      return "role_matrix";
    case "exam_blueprint":
      return "exam_blueprint";
    case "custom_goal":
      return "custom";
    default:
      return "standard";
  }
}

function objectiveTypeFromDepth(depth: number): typeof standardNodes.$inferInsert["objectiveType"] {
  if (depth <= 0) {
    return "domain";
  }

  if (depth === 1) {
    return "strand";
  }

  return "objective";
}

async function ensureSeededStandards() {
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    const db = getDb();
    const existing = await db
      .select({ id: standardFrameworks.id })
      .from(standardFrameworks)
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    await db.transaction(async (tx) => {
      for (const framework of FRAMEWORKS) {
        await tx.insert(standardFrameworks).values({
          id: framework.id,
          organizationId: null,
          name: framework.name,
          frameworkType:
            framework.kind === "custom" ? "custom_goal" : "academic_standard",
          version:
            typeof framework.publishedYear === "number"
              ? String(framework.publishedYear)
              : null,
          jurisdiction: null,
          subject: framework.subjects[0] ?? null,
          description: framework.description ?? null,
          metadata: {
            abbreviation: framework.abbreviation,
            subjects: framework.subjects,
            gradeLevels: framework.gradeLevels,
            publishedYear: framework.publishedYear ?? null,
            kind: framework.kind,
          },
        });
      }

      for (const [index, standard] of STANDARDS.entries()) {
        await tx.insert(standardNodes).values({
          id: standard.id,
          frameworkId: standard.frameworkId,
          parentId: standard.parentId ?? null,
          code: standard.code,
          title: standard.title,
          description: standard.description ?? null,
          objectiveType: objectiveTypeFromDepth(standard.depth),
          gradeBand: standard.gradeLevel ?? null,
          subject: standard.subject ?? null,
          completionCriteria: {},
          masteryRubric: {},
          depth: standard.depth,
          ordering: index,
          metadata: {
            domain: standard.domain ?? null,
          },
        });
      }
    });
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });

  return seedPromise;
}

function mapFramework(record: typeof standardFrameworks.$inferSelect): StandardsFramework {
  const metadata = record.metadata ?? {};

  return {
    id: record.id,
    name: record.name,
    abbreviation:
      typeof metadata.abbreviation === "string" ? metadata.abbreviation : record.name,
    description: record.description ?? undefined,
    subjects: Array.isArray(metadata.subjects)
      ? metadata.subjects.filter((item): item is string => typeof item === "string")
      : [],
    gradeLevels: Array.isArray(metadata.gradeLevels)
      ? metadata.gradeLevels.filter((item): item is string => typeof item === "string")
      : [],
    kind:
      typeof metadata.kind === "string"
        ? metadata.kind
        : frameworkKindFromType(record.frameworkType),
    publishedYear:
      typeof metadata.publishedYear === "number" ? metadata.publishedYear : undefined,
  };
}

function mapStandard(record: typeof standardNodes.$inferSelect): Standard {
  const metadata = record.metadata ?? {};

  return {
    id: record.id,
    frameworkId: record.frameworkId,
    code: record.code,
    title: record.title,
    description: record.description ?? undefined,
    gradeLevel: record.gradeBand ?? undefined,
    subject: record.subject ?? undefined,
    domain: typeof metadata.domain === "string" ? metadata.domain : undefined,
    parentId: record.parentId ?? undefined,
    depth: record.depth,
    hasChildren: false,
  };
}

export async function listFrameworks(options?: {
  organizationId?: string | null;
}): Promise<StandardsFramework[]> {
  await ensureSeededStandards();
  const db = getDb();

  const rows = await db
    .select()
    .from(standardFrameworks)
    .where(
      options?.organizationId
        ? or(
            isNull(standardFrameworks.organizationId),
            eq(standardFrameworks.organizationId, options.organizationId),
          )
        : isNull(standardFrameworks.organizationId),
    )
    .orderBy(asc(standardFrameworks.name));

  return rows.map(mapFramework);
}

export async function getFramework(id: string): Promise<StandardsFramework | undefined> {
  await ensureSeededStandards();
  const framework = await getDb().query.standardFrameworks.findFirst({
    where: eq(standardFrameworks.id, id),
  });
  return framework ? mapFramework(framework) : undefined;
}

export async function listStandards(params: StandardsSearchParams = {}): Promise<Standard[]> {
  await ensureSeededStandards();
  const filters = [];

  if (params.frameworkId) {
    filters.push(eq(standardNodes.frameworkId, params.frameworkId));
  }

  if (params.subject) {
    filters.push(eq(standardNodes.subject, params.subject));
  }

  if (params.gradeLevel) {
    filters.push(eq(standardNodes.gradeBand, params.gradeLevel));
  }

  if (params.parentId !== undefined) {
    filters.push(
      params.parentId === null
        ? isNull(standardNodes.parentId)
        : eq(standardNodes.parentId, params.parentId),
    );
  }

  if (params.query?.trim()) {
    const pattern = `%${params.query.trim()}%`;
    filters.push(
      or(
        ilike(standardNodes.code, pattern),
        ilike(standardNodes.title, pattern),
        ilike(standardNodes.description, pattern),
      )!,
    );
  }

  const rows = await getDb()
    .select()
    .from(standardNodes)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      asc(standardNodes.depth),
      asc(standardNodes.ordering),
      asc(standardNodes.code),
    );

  const rowIds = rows.map((row) => row.id);
  const childRows =
    rowIds.length === 0
      ? []
      : await getDb()
          .select({ parentId: standardNodes.parentId })
          .from(standardNodes)
          .where(inArray(standardNodes.parentId, rowIds));
  const parentIds = new Set(
    childRows
      .map((row) => row.parentId)
      .filter((value): value is string => typeof value === "string"),
  );

  return rows.map((row) => ({
    ...mapStandard(row),
    hasChildren: parentIds.has(row.id),
  }));
}

export async function getStandard(id: string): Promise<Standard | undefined> {
  await ensureSeededStandards();
  const standard = await getDb().query.standardNodes.findFirst({
    where: eq(standardNodes.id, id),
  });
  return standard ? mapStandard(standard) : undefined;
}

export async function getStandardChildren(parentId: string): Promise<Standard[]> {
  return listStandards({ parentId });
}

export async function getStandardBreadcrumbs(id: string): Promise<Standard[]> {
  const breadcrumbs: Standard[] = [];
  let current = await getStandard(id);

  while (current) {
    breadcrumbs.unshift(current);
    current = current.parentId ? await getStandard(current.parentId) : undefined;
  }

  return breadcrumbs;
}

export async function listCustomGoals(householdId: string): Promise<CustomGoal[]> {
  await ensureSeededStandards();
  const customFramework = await getDb().query.standardFrameworks.findFirst({
    where: and(
      eq(standardFrameworks.organizationId, householdId),
      eq(standardFrameworks.frameworkType, "custom_goal"),
    ),
  });

  if (!customFramework) {
    return [];
  }

  const rows = await getDb()
    .select()
    .from(standardNodes)
    .where(eq(standardNodes.frameworkId, customFramework.id))
    .orderBy(asc(standardNodes.ordering), asc(standardNodes.createdAt));

  return rows.map((row) => ({
    id: row.id,
    householdId,
    title: row.title,
    description: row.description ?? undefined,
    subject: row.subject ?? undefined,
    gradeLevel: row.gradeBand ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createCustomGoal(input: CreateCustomGoalInput): Promise<CustomGoal> {
  await ensureSeededStandards();
  const db = getDb();
  let framework = await db.query.standardFrameworks.findFirst({
    where: and(
      eq(standardFrameworks.organizationId, input.householdId),
      eq(standardFrameworks.frameworkType, "custom_goal"),
    ),
  });

  if (!framework) {
    const [created] = await db
      .insert(standardFrameworks)
      .values({
        organizationId: input.householdId,
        name: "Custom Organization Goals",
        frameworkType: "custom_goal",
        version: "1",
        jurisdiction: null,
        subject: input.subject ?? null,
        description: "Organization-defined custom goals.",
        metadata: {
          abbreviation: "Custom",
          subjects: input.subject ? [input.subject] : [],
          gradeLevels: input.gradeLevel ? [input.gradeLevel] : [],
          kind: "custom",
        },
      })
      .returning();
    framework = created;
  }

  const existingCount = await db
    .select({ id: standardNodes.id })
    .from(standardNodes)
    .where(eq(standardNodes.frameworkId, framework.id));

  const [createdGoal] = await db
    .insert(standardNodes)
    .values({
      frameworkId: framework.id,
      parentId: null,
      code: `CUSTOM-${existingCount.length + 1}`,
      title: input.title,
      description: input.description ?? null,
      objectiveType: "objective",
      gradeBand: input.gradeLevel ?? null,
      subject: input.subject ?? null,
      completionCriteria: {},
      masteryRubric: {},
      depth: 0,
      ordering: existingCount.length,
      metadata: {
        source: "custom_goal",
      },
    })
    .returning();

  return {
    id: createdGoal.id,
    householdId: input.householdId,
    title: createdGoal.title,
    description: createdGoal.description ?? undefined,
    subject: createdGoal.subject ?? undefined,
    gradeLevel: createdGoal.gradeBand ?? undefined,
    createdAt: createdGoal.createdAt.toISOString(),
    updatedAt: createdGoal.updatedAt.toISOString(),
  };
}

export async function deleteCustomGoal(id: string): Promise<void> {
  await getDb().delete(standardNodes).where(eq(standardNodes.id, id));
}

export async function suggestStandards(
  objectiveText: string,
  params: Pick<StandardsSearchParams, "frameworkId" | "gradeLevel" | "subject"> = {},
): Promise<Standard[]> {
  const keywords = objectiveText
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const candidates = await listStandards({ ...params });

  return candidates
    .map((standard) => {
      const haystack = `${standard.code} ${standard.title} ${standard.description ?? ""}`.toLowerCase();
      const score = keywords.filter((keyword) => haystack.includes(keyword)).length;
      return { standard, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((entry) => entry.standard);
}

export async function listStandardsByIds(ids: string[]): Promise<Standard[]> {
  if (ids.length === 0) {
    return [];
  }

  await ensureSeededStandards();
  const rows = await getDb()
    .select()
    .from(standardNodes)
    .where(inArray(standardNodes.id, ids));

  return rows.map(mapStandard);
}
