import { normalizeCurriculumLabel } from "./labels";
import { CurriculumLessonTypeSchema, type CurriculumLessonType } from "./types";

export interface CurriculumItemMetadataRepairCandidate {
  id: string;
  parentItemId: string | null;
  itemType: string;
  title: string;
  position: number;
  metadata: Record<string, unknown> | null | undefined;
}

function toRefSlug(value: string) {
  return (
    normalizeCurriculumLabel(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function deriveLegacyUnitRef(params: { title: string; position: number }) {
  return `unit:${params.position + 1}:${toRefSlug(params.title)}`;
}

export function deriveLegacyLessonRef(params: {
  title: string;
  position: number;
  unitRef: string;
}) {
  return `lesson:${params.unitRef.replace(/^unit:/, "")}:${params.position + 1}:${toRefSlug(params.title)}`;
}

export function resolveLegacyLessonType(value: unknown): CurriculumLessonType {
  const parsed = CurriculumLessonTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : "task";
}

export function buildLegacyCurriculumItemMetadataRepairs(
  items: CurriculumItemMetadataRepairCandidate[],
) {
  const repairs: Array<{ id: string; metadata: Record<string, unknown> }> = [];
  const unitRefById = new Map<string, string>();

  for (const item of items) {
    if (item.itemType !== "unit") {
      continue;
    }

    const metadata = asRecord(item.metadata);
    const unitRef =
      typeof metadata.unitRef === "string" && metadata.unitRef.trim().length > 0
        ? metadata.unitRef
        : deriveLegacyUnitRef({ title: item.title, position: item.position });
    unitRefById.set(item.id, unitRef);

    if (metadata.unitRef !== unitRef) {
      repairs.push({
        id: item.id,
        metadata: {
          ...metadata,
          unitRef,
        },
      });
    }
  }

  for (const item of items) {
    if (item.itemType !== "lesson") {
      continue;
    }

    const metadata = asRecord(item.metadata);
    const fallbackUnitRef =
      (item.parentItemId ? unitRefById.get(item.parentItemId) : null) ?? "unit:legacy";
    const unitRef =
      typeof metadata.unitRef === "string" && metadata.unitRef.trim().length > 0
        ? metadata.unitRef
        : fallbackUnitRef;
    const lessonRef =
      typeof metadata.lessonRef === "string" && metadata.lessonRef.trim().length > 0
        ? metadata.lessonRef
        : deriveLegacyLessonRef({
            title: item.title,
            position: item.position,
            unitRef,
          });
    const lessonType = resolveLegacyLessonType(metadata.lessonType);

    if (
      metadata.unitRef !== unitRef
      || metadata.lessonRef !== lessonRef
      || metadata.lessonType !== lessonType
    ) {
      repairs.push({
        id: item.id,
        metadata: {
          ...metadata,
          unitRef,
          lessonRef,
          lessonType,
        },
      });
    }
  }

  return repairs;
}
