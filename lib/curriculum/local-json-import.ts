import "@/lib/server-only";

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
    unitRef: string;
    title: string;
    description: string;
    estimatedWeeks?: number;
    estimatedSessions?: number;
    skillRefs: string[];
  }>;
}

export async function loadLocalCurriculumJson(): Promise<ImportedCurriculumDocument> {
  const { default: data } = await import("@/curriculum.json");
  return data as unknown as ImportedCurriculumDocument;
}
