import type {
  CurriculumAiDocumentNode,
  CurriculumAiGeneratedArtifact,
  CurriculumAiSkill,
} from "./ai-draft";

export interface CanonicalSkillRefEntry {
  skillId: string;
  skillRef: string;
  title: string;
  domainTitle: string;
  strandTitle: string;
  goalGroupTitle: string;
  path: string[];
}

export interface CanonicalCurriculumUnit {
  title: string;
  description: string;
  estimatedWeeks?: number;
  estimatedSessions?: number;
  unitRef: string;
  skillIds: string[];
  skillRefs: string[];
}

export interface CanonicalCurriculumArtifact {
  source: CurriculumAiGeneratedArtifact["source"];
  intakeSummary: string;
  pacing: CurriculumAiGeneratedArtifact["pacing"];
  document: Record<string, CurriculumAiDocumentNode>;
  units: CanonicalCurriculumUnit[];
  skillCatalog: CanonicalSkillRefEntry[];
}

type UnknownRecord = Record<string, unknown>;

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugify(value: string) {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function assertUniqueRefs(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label} "${value}" in canonical curriculum artifact.`);
    }
    seen.add(value);
  }
}

function canonicalizeSkill(skill: CurriculumAiSkill, index: number): CanonicalSkillRefEntry {
  const domainTitle = normalizeLabel(skill.domainTitle);
  const strandTitle = normalizeLabel(skill.strandTitle);
  const goalGroupTitle = normalizeLabel(skill.goalGroupTitle);
  const title = normalizeLabel(skill.title);
  const skillId = normalizeLabel(skill.skillId);

  if (!domainTitle || !strandTitle || !goalGroupTitle || !title || !skillId) {
    throw new Error(`Skill ${index + 1} is missing skillId, title, or hierarchy labels.`);
  }

  const path = [domainTitle, strandTitle, goalGroupTitle, title];
  return {
    skillId,
    skillRef: `skill:${path.map(slugify).join("/")}`,
    title,
    domainTitle,
    strandTitle,
    goalGroupTitle,
    path,
  };
}

function buildDocument(skillCatalog: CanonicalSkillRefEntry[]): Record<string, CurriculumAiDocumentNode> {
  const document: Record<string, CurriculumAiDocumentNode> = {};

  for (const skill of skillCatalog) {
    const domainNode = (document[skill.domainTitle] ??= {});
    if (typeof domainNode !== "object" || Array.isArray(domainNode)) {
      throw new Error(`Domain "${skill.domainTitle}" conflicts with another curriculum node shape.`);
    }

    const strandNode = ((domainNode as Record<string, CurriculumAiDocumentNode>)[skill.strandTitle] ??= {});
    if (typeof strandNode !== "object" || Array.isArray(strandNode)) {
      throw new Error(
        `Strand "${skill.domainTitle} > ${skill.strandTitle}" conflicts with another curriculum node shape.`,
      );
    }

    const goalGroupNode = ((strandNode as Record<string, CurriculumAiDocumentNode>)[skill.goalGroupTitle] ??= []);
    if (!Array.isArray(goalGroupNode)) {
      throw new Error(
        `Goal group "${skill.domainTitle} > ${skill.strandTitle} > ${skill.goalGroupTitle}" conflicts with another curriculum node shape.`,
      );
    }

    goalGroupNode.push(skill.title);
  }

  return document;
}

function canonicalizeUnit(params: {
  rawUnit: UnknownRecord;
  skillCatalog: CanonicalSkillRefEntry[];
  unitIndex: number;
}): CanonicalCurriculumUnit {
  const title = typeof params.rawUnit.title === "string" ? params.rawUnit.title.trim() : "";
  const description =
    typeof params.rawUnit.description === "string" ? params.rawUnit.description.trim() : "";
  const unitRef = typeof params.rawUnit.unitRef === "string" ? params.rawUnit.unitRef.trim() : "";
  const explicitSkillIds = Array.isArray(params.rawUnit.skillIds)
    ? params.rawUnit.skillIds.filter((value): value is string => typeof value === "string")
    : [];

  if (!title || !description || !unitRef) {
    throw new Error(`Unit ${params.unitIndex + 1} is missing title, description, or unitRef.`);
  }
  if (explicitSkillIds.length === 0) {
    throw new Error(`Unit "${title}" must include at least one skillId.`);
  }

  const skillRefs: string[] = [];
  const dedupedSkillIds: string[] = [];
  const seenIds = new Set<string>();

  for (const skillId of explicitSkillIds) {
    if (seenIds.has(skillId)) {
      continue;
    }
    const skill = params.skillCatalog.find((entry) => entry.skillId === skillId);
    if (!skill) {
      throw new Error(`Unit "${title}" references unknown skill ids: ${skillId}`);
    }
    seenIds.add(skillId);
    dedupedSkillIds.push(skillId);
    skillRefs.push(skill.skillRef);
  }

  return {
    title,
    description,
    unitRef,
    estimatedWeeks:
      typeof params.rawUnit.estimatedWeeks === "number" ? params.rawUnit.estimatedWeeks : undefined,
    estimatedSessions:
      typeof params.rawUnit.estimatedSessions === "number"
        ? params.rawUnit.estimatedSessions
        : undefined,
    skillIds: dedupedSkillIds,
    skillRefs,
  };
}

export function canonicalizeCurriculumArtifact(
  artifact: CurriculumAiGeneratedArtifact,
): CanonicalCurriculumArtifact {
  const skillCatalog = artifact.skills.map((skill, index) => canonicalizeSkill(skill, index));
  assertUniqueRefs(skillCatalog.map((entry) => entry.skillId), "skillId");
  assertUniqueRefs(skillCatalog.map((entry) => entry.skillRef), "skillRef");

  const units = artifact.units.map((unit, unitIndex) =>
    canonicalizeUnit({
      rawUnit: unit as unknown as UnknownRecord,
      skillCatalog,
      unitIndex,
    }),
  );
  assertUniqueRefs(units.map((unit) => unit.unitRef), "unitRef");

  return {
    source: artifact.source,
    intakeSummary: artifact.intakeSummary,
    pacing: artifact.pacing,
    document: buildDocument(skillCatalog),
    units,
    skillCatalog,
  };
}
