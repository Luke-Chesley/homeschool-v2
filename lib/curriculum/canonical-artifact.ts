import type { CurriculumAiGeneratedArtifact } from "./ai-draft";

export type CanonicalLessonType =
  | "task"
  | "skill_support"
  | "concept"
  | "setup"
  | "reflection"
  | "assessment";

export interface CanonicalSkillRefEntry {
  skillRef: string;
  title: string;
  path: string[];
  description?: string;
}

export interface CanonicalCurriculumLesson {
  title: string;
  description: string;
  subject?: string;
  estimatedMinutes?: number;
  materials: string[];
  objectives: string[];
  unitRef: string;
  lessonRef: string;
  lessonType: CanonicalLessonType;
  linkedSkillRefs: string[];
}

export interface CanonicalCurriculumUnit {
  title: string;
  description: string;
  estimatedWeeks?: number;
  estimatedSessions?: number;
  unitRef: string;
  lessons: CanonicalCurriculumLesson[];
}

export interface CanonicalCurriculumLaunchPlan {
  recommendedHorizon: CurriculumAiGeneratedArtifact["launchPlan"]["recommendedHorizon"];
  openingLessonRefs: string[];
  openingSkillRefs: string[];
  scopeSummary: string;
  initialSliceUsed: boolean;
  initialSliceLabel?: string | null;
  entryStrategy?: CurriculumAiGeneratedArtifact["launchPlan"]["entryStrategy"];
  entryLabel?: string | null;
  continuationMode?: CurriculumAiGeneratedArtifact["launchPlan"]["continuationMode"];
}

export interface CanonicalCurriculumArtifact {
  source: CurriculumAiGeneratedArtifact["source"];
  intakeSummary: string;
  pacing: CurriculumAiGeneratedArtifact["pacing"];
  document: CurriculumAiGeneratedArtifact["document"];
  progression?: CurriculumAiGeneratedArtifact["progression"];
  units: CanonicalCurriculumUnit[];
  launchPlan: CanonicalCurriculumLaunchPlan;
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

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function inferLessonType(rawLesson: UnknownRecord): CanonicalLessonType {
  const explicit = rawLesson.lessonType;
  if (
    explicit === "task" ||
    explicit === "skill_support" ||
    explicit === "concept" ||
    explicit === "setup" ||
    explicit === "reflection" ||
    explicit === "assessment"
  ) {
    return explicit;
  }

  const lessonText = [
    typeof rawLesson.title === "string" ? rawLesson.title : "",
    typeof rawLesson.description === "string" ? rawLesson.description : "",
    ...readStringArray(rawLesson.objectives),
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(set up|setup|prepare|materials|orientation|introduce the routine)\b/.test(lessonText)) {
    return "setup";
  }
  if (/\b(reflect|reflection|review journal|debrief)\b/.test(lessonText)) {
    return "reflection";
  }
  if (/\b(assess|assessment|quiz|check for understanding|demonstrate mastery|evaluate)\b/.test(
    lessonText,
  )) {
    return "assessment";
  }
  if (/\b(explain|understand|introduce|concept|vocabulary|idea)\b/.test(lessonText)) {
    return "concept";
  }
  if (/\b(practice|support|guided|scaffold|reteach|warm-up)\b/.test(lessonText)) {
    return "skill_support";
  }
  return "task";
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

function resolveLessonSkillRefs(params: {
  rawLesson: UnknownRecord;
  skillCatalog: CanonicalSkillRefEntry[];
}): { linkedSkillRefs: string[] } {
  const explicitRefs = readStringArray(params.rawLesson.linkedSkillRefs);
  const missing = explicitRefs.filter(
    (skillRef) => !params.skillCatalog.some((entry) => entry.skillRef === skillRef),
  );
  if (missing.length > 0) {
    throw new Error(
      `Lesson "${params.rawLesson.title}" references unknown skill refs: ${missing.join(", ")}`,
    );
  }

  return {
    linkedSkillRefs: [...new Set(explicitRefs)],
  };
}

function buildLaunchPlan(params: {
  artifact: CurriculumAiGeneratedArtifact;
  units: CanonicalCurriculumUnit[];
  skillCatalog: CanonicalSkillRefEntry[];
}) {
  const rawLaunchPlan = asRecord(params.artifact.launchPlan) ?? {};
  const explicitLessonRefs = readStringArray(rawLaunchPlan.openingLessonRefs);
  const explicitSkillRefs = readStringArray(rawLaunchPlan.openingSkillRefs);
  const allLessons = params.units.flatMap((unit) => unit.lessons);
  const lessonsByRef = new Map(allLessons.map((lesson) => [lesson.lessonRef, lesson]));

  const openingLessonRefs =
    explicitLessonRefs.length > 0 ? explicitLessonRefs : [];

  if (openingLessonRefs.length === 0) {
    throw new Error(
      "Curriculum artifact launchPlan must include explicit openingLessonRefs.",
    );
  }

  const missingLessonRefs = openingLessonRefs.filter((lessonRef) => !lessonsByRef.has(lessonRef));
  if (missingLessonRefs.length > 0) {
    throw new Error(
      `Curriculum artifact launchPlan references unknown lesson refs: ${missingLessonRefs.join(", ")}`,
    );
  }

  const openingSkillRefs =
    explicitSkillRefs.length > 0
      ? [...new Set(explicitSkillRefs)]
      : [...new Set(
          openingLessonRefs.flatMap((lessonRef) => lessonsByRef.get(lessonRef)?.linkedSkillRefs ?? []),
        )];

  const missingSkillRefs = openingSkillRefs.filter(
    (skillRef) => !params.skillCatalog.some((entry) => entry.skillRef === skillRef),
  );
  if (missingSkillRefs.length > 0) {
    throw new Error(
      `Curriculum artifact launchPlan references unknown skill refs: ${missingSkillRefs.join(", ")}`,
    );
  }

  return {
    recommendedHorizon: params.artifact.launchPlan.recommendedHorizon,
    openingLessonRefs,
    openingSkillRefs,
    scopeSummary: params.artifact.launchPlan.scopeSummary,
    initialSliceUsed: params.artifact.launchPlan.initialSliceUsed,
    initialSliceLabel: params.artifact.launchPlan.initialSliceLabel,
    entryStrategy: params.artifact.launchPlan.entryStrategy,
    entryLabel: params.artifact.launchPlan.entryLabel,
    continuationMode: params.artifact.launchPlan.continuationMode,
  } satisfies CanonicalCurriculumLaunchPlan;
}

function validateProgressionRefs(
  artifact: CurriculumAiGeneratedArtifact,
  skillCatalog: CanonicalSkillRefEntry[],
) {
  if (!artifact.progression) {
    return;
  }

  const skillRefs = new Set(skillCatalog.map((entry) => entry.skillRef));
  for (const phase of artifact.progression.phases) {
    for (const skillRef of phase.skillRefs) {
      if (!skillRefs.has(skillRef)) {
        throw new Error(`Progression phase "${phase.title}" references unknown skill ref "${skillRef}".`);
      }
    }
  }

  for (const edge of artifact.progression.edges) {
    if (!skillRefs.has(edge.fromSkillRef)) {
      throw new Error(`Progression edge references unknown fromSkillRef "${edge.fromSkillRef}".`);
    }
    if (!skillRefs.has(edge.toSkillRef)) {
      throw new Error(`Progression edge references unknown toSkillRef "${edge.toSkillRef}".`);
    }
  }
}

export function canonicalizeCurriculumArtifact(
  artifact: CurriculumAiGeneratedArtifact,
): CanonicalCurriculumArtifact {
  const skillCatalog = collectSkillCatalog(artifact.document);

  assertUniqueRefs(
    skillCatalog.map((entry) => entry.skillRef),
    "skillRef",
  );

  const units = artifact.units.map((unit, unitIndex) => {
    const rawUnit = unit as unknown as UnknownRecord;
    const unitRef =
      typeof rawUnit.unitRef === "string" && rawUnit.unitRef.trim().length > 0
        ? rawUnit.unitRef
        : `unit:${unitIndex + 1}:${slugify(unit.title)}`;

    const lessons = unit.lessons.map((lesson, lessonIndex) => {
      const rawLesson = lesson as unknown as UnknownRecord;
      const explicitUnitRef =
        typeof rawLesson.unitRef === "string" && rawLesson.unitRef.trim().length > 0
          ? rawLesson.unitRef
          : unitRef;
      if (explicitUnitRef !== unitRef) {
        throw new Error(
          `Lesson "${lesson.title}" unitRef "${explicitUnitRef}" does not match parent unitRef "${unitRef}".`,
        );
      }

      const lessonRef =
        typeof rawLesson.lessonRef === "string" && rawLesson.lessonRef.trim().length > 0
          ? rawLesson.lessonRef
          : `${unitRef}/lesson:${lessonIndex + 1}:${slugify(lesson.title)}`;

      const linkage = resolveLessonSkillRefs({
        rawLesson,
        skillCatalog,
      });

      return {
        title: lesson.title,
        description: lesson.description,
        subject: lesson.subject,
        estimatedMinutes: lesson.estimatedMinutes,
        materials: lesson.materials,
        objectives: lesson.objectives,
        unitRef,
        lessonRef,
        lessonType: inferLessonType(rawLesson),
        linkedSkillRefs: linkage.linkedSkillRefs,
      } satisfies CanonicalCurriculumLesson;
    });

    return {
      title: unit.title,
      description: unit.description,
      estimatedWeeks: unit.estimatedWeeks,
      estimatedSessions: unit.estimatedSessions,
      unitRef,
      lessons,
    } satisfies CanonicalCurriculumUnit;
  });

  assertUniqueRefs(
    units.map((unit) => unit.unitRef),
    "unitRef",
  );
  assertUniqueRefs(
    units.flatMap((unit) => unit.lessons.map((lesson) => lesson.lessonRef)),
    "lessonRef",
  );

  validateProgressionRefs(artifact, skillCatalog);

  return {
    source: artifact.source,
    intakeSummary: artifact.intakeSummary,
    pacing: artifact.pacing,
    document: artifact.document,
    progression: artifact.progression,
    units,
    launchPlan: buildLaunchPlan({
      artifact,
      units,
      skillCatalog,
    }),
    skillCatalog,
  };
}
