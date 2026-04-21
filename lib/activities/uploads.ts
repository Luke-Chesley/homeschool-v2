import { z } from "zod";

import type { ActivitySpec } from "./spec";

export const ActivityAssetKindSchema = z.enum(["file", "image"]);
export type ActivityAssetKind = z.infer<typeof ActivityAssetKindSchema>;

export const ActivityAssetComponentTypeSchema = z.enum(["file_upload", "image_capture"]);
export type ActivityAssetComponentType = z.infer<typeof ActivityAssetComponentTypeSchema>;

export const ActivityAttachmentEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: ActivityAssetKindSchema.optional(),
  storageBucket: z.string().min(1).optional(),
  storagePath: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  lastModified: z.number().int().nonnegative().optional(),
  uploadedAt: z.string().datetime().optional(),
});
export type ActivityAttachmentEntry = z.infer<typeof ActivityAttachmentEntrySchema>;

export type StoredActivityAttachment = ActivityAttachmentEntry & {
  kind: ActivityAssetKind;
  storageBucket: string;
  storagePath: string;
  uploadedAt: string;
};

export interface UploadedActivityComponentAsset {
  componentId: string;
  componentType: ActivityAssetComponentType;
  prompt: string;
  note: string | null;
  asset: StoredActivityAttachment;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeActivityUploadFileName(fileName: string) {
  return (
    fileName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || "activity-upload"
  );
}

export function isStoredActivityAttachment(
  entry: ActivityAttachmentEntry,
): entry is StoredActivityAttachment {
  return (
    typeof entry.kind === "string" &&
    typeof entry.storageBucket === "string" &&
    entry.storageBucket.trim().length > 0 &&
    typeof entry.storagePath === "string" &&
    entry.storagePath.trim().length > 0 &&
    typeof entry.uploadedAt === "string" &&
    entry.uploadedAt.trim().length > 0
  );
}

export function coerceActivityAttachmentEntries(
  value: unknown,
  collectionKey: "files" | "images",
  kind: ActivityAssetKind,
): ActivityAttachmentEntry[] {
  if (!isRecord(value)) {
    return [];
  }

  const directEntries = value[collectionKey];
  if (Array.isArray(directEntries)) {
    return directEntries.reduce<ActivityAttachmentEntry[]>((entries, entry, index) => {
        if (typeof entry === "string" && entry.trim().length > 0) {
          entries.push({
            id: `${collectionKey}-legacy-${index}`,
            name: entry.trim(),
            kind,
          });
          return entries;
        }

        const parsed = ActivityAttachmentEntrySchema.safeParse(entry);
        if (!parsed.success) {
          return entries;
        }

        entries.push({
          ...parsed.data,
          kind: parsed.data.kind ?? kind,
        });
        return entries;
      }, []);
  }

  const legacyNames = value.fileNames;
  if (Array.isArray(legacyNames)) {
    return legacyNames
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((name, index) => ({
        id: `${collectionKey}-legacy-${index}-${name}`,
        name: name.trim(),
        kind,
      }));
  }

  return [];
}

export function collectUploadedActivityAssets(params: {
  spec: ActivitySpec;
  evidence: Record<string, unknown> | undefined;
}): UploadedActivityComponentAsset[] {
  const collected: UploadedActivityComponentAsset[] = [];

  for (const component of params.spec.components) {
    if (component.type !== "file_upload" && component.type !== "image_capture") {
      continue;
    }

    const componentValue = params.evidence?.[component.id];
    const entries = coerceActivityAttachmentEntries(
      componentValue,
      component.type === "file_upload" ? "files" : "images",
      component.type === "file_upload" ? "file" : "image",
    );

    const note =
      component.type === "file_upload" &&
      isRecord(componentValue) &&
      typeof componentValue.note === "string" &&
      componentValue.note.trim().length > 0
        ? componentValue.note.trim()
        : null;

    for (const entry of entries) {
      if (!isStoredActivityAttachment(entry)) {
        continue;
      }

      collected.push({
        componentId: component.id,
        componentType: component.type,
        prompt: component.prompt,
        note,
        asset: entry,
      });
    }
  }

  return collected;
}
