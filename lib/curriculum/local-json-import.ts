import "@/lib/server-only";

import type { CurriculumSourceKind } from "./types";
import type { CurriculumAiProgression } from "./ai-draft";

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
  progression?: CurriculumAiProgression;
  metadata?: Record<string, unknown>;
  units?: Array<{
    unitRef: string;
    title: string;
    description: string;
    estimatedWeeks?: number;
    estimatedSessions?: number;
    lessons: Array<{
      unitRef: string;
      lessonRef: string;
      lessonType: "task" | "skill_support" | "concept" | "setup" | "reflection" | "assessment";
      title: string;
      description: string;
      subject?: string;
      estimatedMinutes?: number;
      materials: string[];
      objectives: string[];
      linkedSkillRefs: string[];
    }>;
  }>;
}

export async function loadLocalCurriculumJson(): Promise<ImportedCurriculumDocument> {
  const { default: data } = await import("@/curriculum.json");
  return data as unknown as ImportedCurriculumDocument;
}
