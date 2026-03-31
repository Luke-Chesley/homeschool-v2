import { readFile } from "node:fs/promises";
import path from "node:path";

export type CurriculumJsonNode =
  | string
  | string[]
  | {
      [key: string]: CurriculumJsonNode;
    };

export interface ImportedCurriculumDocument {
  title: string;
  description: string;
  kind: "external";
  academicYear?: string;
  subjects: string[];
  gradeLevels: string[];
  document: Record<string, CurriculumJsonNode>;
}

export async function loadLocalCurriculumJson(): Promise<ImportedCurriculumDocument> {
  const filePath = path.join(process.cwd(), "curriculum.json");
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, CurriculumJsonNode>;

  return {
    title: "Imported Curriculum JSON",
    description: "Loaded from curriculum.json in the project root.",
    kind: "external",
    subjects: [],
    gradeLevels: [],
    document: parsed,
  };
}
