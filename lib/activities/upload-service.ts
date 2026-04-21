import "@/lib/server-only";

import { getAttemptStore } from "./attempt-store";
import { getSession } from "./session-service";
import { parseActivitySpec, isActivitySpec } from "./spec";
import type { StoredActivityAttachment, ActivityAssetKind, ActivityAssetComponentType } from "./uploads";
import { sanitizeActivityUploadFileName } from "./uploads";
import { getDb } from "@/lib/db/server";
import { getAdminStorageClient } from "@/lib/storage/client";
import { storageBuckets } from "@/lib/storage/buckets";
import { buildLearnerStoragePath } from "@/lib/storage/paths";

function buildActivityUploadPrefix(params: {
  organizationId: string;
  learnerId: string;
  lessonSessionId: string;
  attemptId: string;
  componentId: string;
}) {
  return buildLearnerStoragePath(
    params.organizationId,
    params.learnerId,
    "activity-evidence",
    params.lessonSessionId,
    params.attemptId,
    params.componentId,
  );
}

async function resolveUploadContext(params: {
  attemptId: string;
  learnerId: string;
  componentId: string;
  componentType: ActivityAssetComponentType;
  kind: ActivityAssetKind;
}) {
  const attempt = await getAttemptStore().get(params.attemptId);
  if (!attempt) {
    throw new Error(`Attempt not found: ${params.attemptId}`);
  }

  if (attempt.learnerId !== params.learnerId) {
    throw new Error("Attempt does not belong to the active learner.");
  }

  if (attempt.status !== "in_progress") {
    throw new Error("Only in-progress attempts can upload or remove evidence.");
  }

  const session = await getSession(attempt.sessionId);
  if (!session || !isActivitySpec(session.definition)) {
    throw new Error("Structured uploads are only available for activity specs.");
  }

  const spec = parseActivitySpec(session.definition);
  if (!spec) {
    throw new Error("Could not parse the activity spec for this attempt.");
  }

  const component = spec.components.find((item) => item.id === params.componentId);
  if (!component || component.type !== params.componentType) {
    throw new Error("Requested upload for an unknown component.");
  }

  if (params.kind === "file" && component.type !== "file_upload") {
    throw new Error("This component does not accept file uploads.");
  }

  if (params.kind === "image" && component.type !== "image_capture") {
    throw new Error("This component does not accept image uploads.");
  }

  const learner = await getDb().query.learners.findFirst({
    where: (table, { eq }) => eq(table.id, params.learnerId),
    columns: {
      organizationId: true,
    },
  });

  if (!learner) {
    throw new Error(`Learner not found: ${params.learnerId}`);
  }

  return {
    attempt,
    session,
    component,
    organizationId: learner.organizationId,
    lessonSessionId: session.lessonId ?? session.id,
  };
}

export async function uploadActivityAttemptAsset(params: {
  attemptId: string;
  learnerId: string;
  componentId: string;
  componentType: ActivityAssetComponentType;
  kind: ActivityAssetKind;
  file: File;
}): Promise<StoredActivityAttachment> {
  const context = await resolveUploadContext(params);

  if (params.kind === "image" && !params.file.type.startsWith("image/")) {
    throw new Error("Only image files can be attached to photo capture components.");
  }

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const fileName = sanitizeActivityUploadFileName(params.file.name);
  const storagePath = `${buildActivityUploadPrefix({
    organizationId: context.organizationId,
    learnerId: params.learnerId,
    lessonSessionId: context.lessonSessionId,
    attemptId: params.attemptId,
    componentId: params.componentId,
  })}/${crypto.randomUUID()}-${fileName}`;

  const storage = getAdminStorageClient().from(storageBuckets.learnerUploads);
  const upload = await storage.upload(storagePath, buffer, {
    cacheControl: "3600",
    contentType: params.file.type || undefined,
    upsert: false,
  });

  if (upload.error) {
    throw new Error(upload.error.message);
  }

  return {
    id: crypto.randomUUID(),
    kind: params.kind,
    name: params.file.name,
    storageBucket: storageBuckets.learnerUploads,
    storagePath,
    mimeType: params.file.type || undefined,
    sizeBytes: Number.isFinite(params.file.size) ? params.file.size : undefined,
    lastModified: Number.isFinite(params.file.lastModified) ? params.file.lastModified : undefined,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteActivityAttemptAsset(params: {
  attemptId: string;
  learnerId: string;
  componentId: string;
  componentType: ActivityAssetComponentType;
  kind: ActivityAssetKind;
  asset: StoredActivityAttachment;
}) {
  const context = await resolveUploadContext(params);

  if (params.asset.storageBucket !== storageBuckets.learnerUploads) {
    throw new Error("This uploaded asset does not belong to the learner upload bucket.");
  }

  const expectedPrefix = `${buildActivityUploadPrefix({
    organizationId: context.organizationId,
    learnerId: params.learnerId,
    lessonSessionId: context.lessonSessionId,
    attemptId: params.attemptId,
    componentId: params.componentId,
  })}/`;

  if (!params.asset.storagePath.startsWith(expectedPrefix)) {
    throw new Error("This uploaded asset is not available for the current activity attempt.");
  }

  const storage = getAdminStorageClient().from(storageBuckets.learnerUploads);
  const removal = await storage.remove([params.asset.storagePath]);
  if (removal.error) {
    throw new Error(removal.error.message);
  }
}
