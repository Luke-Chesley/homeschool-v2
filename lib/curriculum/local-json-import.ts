import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CurriculumSourceKind } from "./types";

export type CurriculumJsonNode =
  | string
  | string[]
  | {
      [key: string]: CurriculumJsonNode;
    };

export interface ImportedCurriculumDocument {
  title: string;
  description: string;
  kind: CurriculumSourceKind;
  academicYear?: string;
  subjects: string[];
  gradeLevels: string[];
  document: Record<string, CurriculumJsonNode>;
  metadata?: Record<string, unknown>;
  units?: Array<{
    title: string;
    description?: string;
    estimatedWeeks?: number;
    lessons: Array<{
      title: string;
      description?: string;
      subject?: string;
      estimatedMinutes?: number;
      materials?: string[];
      objectives?: string[];
      linkedSkillTitles?: string[];
    }>;
  }>;
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
