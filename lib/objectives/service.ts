import "@/lib/server-only";

import { createRepositories } from "@/lib/db";
import { ensureDatabaseReady, getDb } from "@/lib/db/server";
import type { ObjectiveFramework, ObjectiveNode } from "@/lib/objectives/types";

function mapFramework(row: Awaited<
  ReturnType<ReturnType<typeof createRepositories>["standards"]["listFrameworks"]>
>[number]): ObjectiveFramework {
  return {
    id: row.id,
    organizationId: row.organizationId ?? null,
    name: row.name,
    frameworkType: row.frameworkType,
    version: row.version ?? null,
    jurisdiction: row.jurisdiction ?? null,
    subject: row.subject ?? null,
    description: row.description ?? null,
  };
}

function mapNode(row: Awaited<
  ReturnType<ReturnType<typeof createRepositories>["standards"]["listNodesByFramework"]>
>[number]): ObjectiveNode {
  return {
    id: row.id,
    frameworkId: row.frameworkId,
    parentId: row.parentId ?? null,
    code: row.code,
    title: row.title,
    description: row.description ?? null,
    objectiveType: row.objectiveType,
    gradeBand: row.gradeBand ?? null,
    subject: row.subject ?? null,
    depth: row.depth,
    completionCriteria: row.completionCriteria ?? {},
    masteryRubric: row.masteryRubric ?? {},
  };
}

export async function listObjectiveFrameworks(organizationId: string) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const frameworks = await repos.standards.listFrameworksForOrganization(organizationId);
  return frameworks.map(mapFramework);
}

export async function listObjectivesForFramework(frameworkId: string) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const nodes = await repos.standards.listNodesByFramework(frameworkId);
  return nodes.map(mapNode);
}

export async function searchObjectives(params: {
  frameworkId: string;
  query: string;
  subject?: string;
  gradeBand?: string;
}) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const nodes = await repos.standards.searchNodes(params);
  return nodes.map(mapNode);
}
