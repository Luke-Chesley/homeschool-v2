export type ObjectiveFrameworkType =
  | "academic_standard"
  | "competency_framework"
  | "role_matrix"
  | "exam_blueprint"
  | "custom_goal";

export type ObjectiveNodeType =
  | "domain"
  | "strand"
  | "competency"
  | "objective"
  | "checkpoint";

export interface ObjectiveFramework {
  id: string;
  organizationId: string | null;
  name: string;
  frameworkType: ObjectiveFrameworkType;
  version: string | null;
  jurisdiction: string | null;
  subject: string | null;
  description: string | null;
}

export interface ObjectiveNode {
  id: string;
  frameworkId: string;
  parentId: string | null;
  code: string;
  title: string;
  description: string | null;
  objectiveType: ObjectiveNodeType;
  gradeBand: string | null;
  subject: string | null;
  depth: number;
  completionCriteria: Record<string, unknown>;
  masteryRubric: Record<string, unknown>;
}
