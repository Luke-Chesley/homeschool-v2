import { readFile } from "node:fs/promises";
import path from "node:path";

type CurriculumJsonNode =
  | string
  | string[]
  | {
      [key: string]: CurriculumJsonNode;
    };

interface LessonDraft {
  title: string;
  objectives: string[];
}

interface ImportedCurriculumDraft {
  title: string;
  description: string;
  kind: "external";
  academicYear?: string;
  subjects: string[];
  gradeLevels: string[];
  units: Array<{
    title: string;
    lessons: LessonDraft[];
  }>;
}

function cleanLabel(value: string) {
  return value.replace(/^GOAL:\s*/i, "").trim();
}

function collectLessonDrafts(
  node: CurriculumJsonNode,
  pathSegments: string[] = []
): LessonDraft[] {
  if (typeof node === "string") {
    return [
      {
        title: pathSegments.length > 0 ? pathSegments.map(cleanLabel).join(" / ") : "Overview",
        objectives: [node.trim()].filter(Boolean),
      },
    ];
  }

  if (Array.isArray(node)) {
    return [
      {
        title: pathSegments.length > 0 ? pathSegments.map(cleanLabel).join(" / ") : "Overview",
        objectives: node.map((item) => item.trim()).filter(Boolean),
      },
    ];
  }

  return Object.entries(node).flatMap(([key, value]) =>
    collectLessonDrafts(value, [...pathSegments, key])
  );
}

export async function loadLocalCurriculumJson(): Promise<ImportedCurriculumDraft> {
  const filePath = path.join(process.cwd(), "curriculum.json");
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, CurriculumJsonNode>;

  const units = Object.entries(parsed).map(([unitTitle, unitValue]) => ({
    title: cleanLabel(unitTitle),
    lessons: collectLessonDrafts(unitValue).filter((lesson) => lesson.objectives.length > 0),
  }));

  return {
    title: "Imported Curriculum JSON",
    description: "Loaded from curriculum.json in the project root.",
    kind: "external",
    subjects: [],
    gradeLevels: [],
    units,
  };
}
