import type { CurriculumAiGeneratedArtifact } from "./ai-draft";

export interface CanonicalSkillRefEntry {
  skillRef: string;
  title: string;
  path: string[];
  description?: string;
}

export interface CanonicalCurriculumUnit {
  title: string;
  description: string;
  estimatedWeeks?: number;
  estimatedSessions?: number;
  unitRef: string;
  skillRefs: string[];
}

export interface CanonicalCurriculumArtifact {
  source: CurriculumAiGeneratedArtifact["source"];
  intakeSummary: string;
  pacing: CurriculumAiGeneratedArtifact["pacing"];
  document: CurriculumAiGeneratedArtifact["document"];
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

function collectSkillCatalog(
  node: CurriculumAiGeneratedArtifact["document"],
  path: string[] = [],
  skills: CanonicalSkillRefEntry[] = [],
): CanonicalSkillRefEntry[] {
  for (const [title, value] of Object.entries(node)) {
    const nextPath = [...path, title];
    if (typeof value === "string") {
      skills.push({
        skillRef: `skill:${nextPath.map(slugify).join("/")}`,
        title,
        path: nextPath,
        description: value.trim() || undefined,
      });
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        skills.push({
          skillRef: `skill:${[...nextPath, item].map(slugify).join("/")}`,
          title: item,
          path: [...nextPath, item],
        });
      }
      continue;
    }

    collectSkillCatalog(value, nextPath, skills);
  }

  return skills;
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

function canonicalizeUnit(params: {
  rawUnit: UnknownRecord;
  skillCatalog: CanonicalSkillRefEntry[];
  unitIndex: number;
}): CanonicalCurriculumUnit {
  const title = typeof params.rawUnit.title === "string" ? params.rawUnit.title.trim() : "";
  const description =
    typeof params.rawUnit.description === "string" ? params.rawUnit.description.trim() : "";
  const unitRef = typeof params.rawUnit.unitRef === "string" ? params.rawUnit.unitRef.trim() : "";
  const explicitSkillRefs = Array.isArray(params.rawUnit.skillRefs)
    ? params.rawUnit.skillRefs.filter((value): value is string => typeof value === "string")
    : [];

  if (!title || !description || !unitRef) {
    throw new Error(`Unit ${params.unitIndex + 1} is missing title, description, or unitRef.`);
  }
  if (explicitSkillRefs.length === 0) {
    throw new Error(`Unit "${title}" must include at least one skillRef.`);
  }

  const missing = explicitSkillRefs.filter(
    (skillRef) => !params.skillCatalog.some((entry) => entry.skillRef === skillRef),
  );
  if (missing.length > 0) {
    throw new Error(`Unit "${title}" references unknown skill refs: ${missing.join(", ")}`);
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
    skillRefs: [...new Set(explicitSkillRefs)],
  };
}

export function canonicalizeCurriculumArtifact(
  artifact: CurriculumAiGeneratedArtifact,
): CanonicalCurriculumArtifact {
  const skillCatalog = collectSkillCatalog(artifact.document);
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
    document: artifact.document,
    units,
    skillCatalog,
  };
}
