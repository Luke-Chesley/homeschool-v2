import "@/lib/server-only";

import { createHash } from "crypto";

import { getRepositories } from "@/lib/db/server";
import { buildOrganizationStoragePath } from "@/lib/storage/paths";
import { getAdminStorageClient } from "@/lib/storage/client";
import { storageBuckets } from "@/lib/storage/buckets";

import {
  type CreateTextIntakeSourcePackageRequest,
  type IntakeSourceAsset,
  type IntakeSourceAssetExtractionStatus,
  type LearningCoreInputFile,
  type IntakeSourcePackageContext,
  type IntakeSourcePackageModality,
  type NormalizedIntakeSourcePackage,
  LearningCoreInputFileSchema,
  NormalizedIntakeSourcePackageSchema,
} from "./types";

const NORMALIZED_TEXT_LIMIT = 12_000;
const LEARNING_CORE_SIGNED_URL_TTL_SECONDS = 60 * 60;

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "upload";
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function capText(value: string, limit = NORMALIZED_TEXT_LIMIT) {
  return value.length <= limit ? value : value.slice(0, limit);
}

function buildDetectedChunks(text: string) {
  const chunks = normalizeWhitespace(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  return chunks.length > 0 ? chunks : [text.slice(0, 120)];
}

function titleFromText(text: string) {
  const firstLine = normalizeWhitespace(text).split("\n")[0]?.trim() ?? "";
  return (firstLine || "Untitled intake").slice(0, 96);
}

function buildFingerprint(parts: string[]) {
  return createHash("sha256").update(parts.join("::")).digest("hex").slice(0, 24);
}

function summarizePackage(params: {
  modality: IntakeSourcePackageModality;
  normalizedText: string;
  assetCount: number;
}) {
  const prefix =
    params.modality === "outline"
      ? "Outline"
      : params.modality === "photo"
        ? "Photo"
        : params.modality === "pdf"
          ? "PDF"
          : params.modality === "image"
            ? "Image"
            : params.modality === "file"
              ? "File"
              : "Text";
  const excerpt = buildDetectedChunks(params.normalizedText)[0] ?? "No extracted text";
  return `${prefix}${params.assetCount > 0 ? ` · ${params.assetCount} asset` : ""} · ${excerpt}`.slice(
    0,
    200,
  );
}

function combineNormalizedText(parts: Array<string | null | undefined>) {
  return capText(
    normalizeWhitespace(
      parts
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part))
        .join("\n\n"),
    ),
  );
}

function packageExtractionStatusFromAssets(
  assets: IntakeSourceAsset[],
): IntakeSourceAssetExtractionStatus {
  if (assets.some((asset) => asset.extractionStatus === "failed")) {
    return "failed";
  }
  if (assets.some((asset) => asset.extractionStatus === "requires_review")) {
    return "requires_review";
  }
  if (assets.some((asset) => asset.extractionStatus === "pending")) {
    return "pending";
  }
  return "ready";
}

function mapAsset(record: Awaited<
  ReturnType<ReturnType<typeof getRepositories>["aiIntake"]["listAssetsForPackage"]>
>[number]): IntakeSourceAsset {
  return {
    id: record.id,
    packageId: record.packageId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    storageBucket: record.storageBucket,
    storagePath: record.storagePath,
    byteSize: record.byteSize ?? null,
    extractionStatus: record.extractionStatus,
    extractedText: record.extractedText ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapPackage(
  record: Awaited<ReturnType<ReturnType<typeof getRepositories>["aiIntake"]["getPackage"]>>,
  assets: IntakeSourceAsset[],
): NormalizedIntakeSourcePackage {
  if (!record) {
    throw new Error("Intake package not found.");
  }

  const metadata = record.metadata as Record<string, unknown>;
  const note = typeof metadata.note === "string" ? metadata.note : null;
  const detectedChunks = Array.isArray(metadata.detectedChunks)
    ? metadata.detectedChunks.filter((entry): entry is string => typeof entry === "string")
    : buildDetectedChunks(record.normalizedText);
  const summary =
    typeof metadata.summary === "string"
      ? metadata.summary
      : summarizePackage({
          modality: record.modality,
          normalizedText: record.normalizedText,
          assetCount: assets.length,
        });

  return NormalizedIntakeSourcePackageSchema.parse({
    id: record.id,
    organizationId: record.organizationId,
    learnerId: record.learnerId,
    title: record.title,
    modality: record.modality,
    status: record.status,
    normalizedText: record.normalizedText,
    note,
    sourceFingerprint: record.sourceFingerprint ?? null,
    detectedChunks,
    summary,
    assetCount: assets.length,
    extractionStatus: packageExtractionStatusFromAssets(assets),
    assets,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toIntakeSourcePackageContext(
  pkg: NormalizedIntakeSourcePackage,
): IntakeSourcePackageContext {
  return {
    id: pkg.id,
    title: pkg.title,
    modality: pkg.modality,
    summary: pkg.summary,
    extractionStatus: pkg.extractionStatus,
    assetCount: pkg.assetCount,
    assetIds: pkg.assets.map((asset) => asset.id),
    detectedChunks: pkg.detectedChunks,
    sourceFingerprint: pkg.sourceFingerprint ?? null,
  };
}

function assetSupportsDirectModelFileInput(params: {
  modality: IntakeSourcePackageModality;
  mimeType: string;
}) {
  return params.modality !== "photo" && params.modality !== "image" && !params.mimeType.startsWith("image/");
}

function buildDirectFileContext(params: {
  modality: IntakeSourcePackageModality;
  fileName: string;
  note?: string | null;
}) {
  const note = params.note?.trim();
  if (note) {
    return note;
  }

  if (params.modality === "pdf") {
    return `Uploaded PDF: ${params.fileName}`;
  }

  return `Uploaded file: ${params.fileName}`;
}

function isPrivateIpv4Hostname(hostname: string) {
  const octets = hostname.split(".").map((value) => Number.parseInt(value, 10));
  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value))) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function shouldInlineLearningCoreFileData(fileUrl: string) {
  try {
    const url = new URL(fileUrl);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== "https:") {
      return true;
    }

    return (
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname === "host.docker.internal" ||
      hostname.endsWith(".local") ||
      isPrivateIpv4Hostname(hostname)
    );
  } catch {
    return true;
  }
}

async function buildInlineLearningCoreFileData(params: {
  bucket: ReturnType<ReturnType<typeof getAdminStorageClient>["from"]>;
  asset: IntakeSourceAsset;
}) {
  const downloaded = await params.bucket.download(params.asset.storagePath);

  if (downloaded.error || !downloaded.data) {
    throw new Error(
      downloaded.error?.message ??
        `Could not load ${params.asset.fileName} from storage for model input.`,
    );
  }

  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  return `data:${params.asset.mimeType};base64,${bytes.toString("base64")}`;
}

async function extractAssetText(params: {
  modality: IntakeSourcePackageModality;
  mimeType: string;
  fileName: string;
  note?: string | null;
}): Promise<{
  extractedText: string;
  extractionStatus: IntakeSourceAssetExtractionStatus;
  extractionMethod: string;
}> {
  const note = params.note?.trim() ?? "";
  const mimeType = params.mimeType.toLowerCase();

  if (params.modality === "photo" || params.modality === "image" || mimeType.startsWith("image/")) {
    if (!note) {
      throw new Error("Add a short note so the photo upload has usable launch context.");
    }

    return {
      extractedText: note,
      extractionStatus: "requires_review",
      extractionMethod: "user_note_only",
    };
  }

  if (
    assetSupportsDirectModelFileInput({
      modality: params.modality,
      mimeType,
    })
  ) {
    return {
      extractedText: buildDirectFileContext({
        modality: params.modality,
        fileName: params.fileName,
        note: params.note,
      }),
      extractionStatus: "ready",
      extractionMethod: "direct_model_file_input",
    };
  }

  if (!note) {
    throw new Error("Add a short note so this uploaded file has usable launch context.");
  }

  return {
    extractedText: note,
    extractionStatus: "requires_review",
    extractionMethod: "user_note_fallback",
  };
}

export async function getNormalizedIntakeSourcePackage(packageId: string) {
  const repos = getRepositories();
  const record = await repos.aiIntake.getPackage(packageId);
  const assets = (await repos.aiIntake.listAssetsForPackage(packageId)).map(mapAsset);
  return mapPackage(record, assets);
}

export async function getNormalizedIntakeSourcePackages(packageIds: string[]) {
  const dedupedIds = [...new Set(packageIds.map((value) => value.trim()).filter(Boolean))];
  return Promise.all(dedupedIds.map((packageId) => getNormalizedIntakeSourcePackage(packageId)));
}

export async function createLearningCoreInputFilesFromSourcePackages(
  packages: NormalizedIntakeSourcePackage[],
) {
  const storage = getAdminStorageClient();
  const files: LearningCoreInputFile[] = [];

  for (const pkg of packages) {
    for (const asset of pkg.assets) {
      if (
        !assetSupportsDirectModelFileInput({
          modality: pkg.modality,
          mimeType: asset.mimeType.toLowerCase(),
        })
      ) {
        continue;
      }

      const bucket = storage.from(asset.storageBucket);
      const signed = await bucket.createSignedUrl(
        asset.storagePath,
        LEARNING_CORE_SIGNED_URL_TTL_SECONDS,
      );

      if (signed.error || !signed.data?.signedUrl) {
        throw new Error(
          signed.error?.message ??
            `Could not create a signed URL for ${asset.fileName}.`,
        );
      }

      const signedUrl = signed.data.signedUrl;
      const directFileInput = shouldInlineLearningCoreFileData(signedUrl)
        ? {
            fileData: await buildInlineLearningCoreFileData({
              bucket,
              asset,
            }),
          }
        : {
            fileUrl: signedUrl,
          };

      files.push(
        LearningCoreInputFileSchema.parse({
          assetId: asset.id,
          packageId: pkg.id,
          title: pkg.title,
          modality: pkg.modality,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          ...directFileInput,
        }),
      );
    }
  }

  return files;
}

export async function createTextIntakeSourcePackage(params: {
  organizationId: string;
  learnerId?: string | null;
  input: CreateTextIntakeSourcePackageRequest;
}) {
  const repos = getRepositories();
  const inputText = normalizeWhitespace(params.input.text);
  const normalizedText = combineNormalizedText([inputText, params.input.note ?? null]);
  const detectedChunks = buildDetectedChunks(normalizedText);
  const title = titleFromText(inputText);
  const summary = summarizePackage({
    modality: params.input.modality,
    normalizedText,
    assetCount: 0,
  });
  const sourceFingerprint = buildFingerprint([params.input.modality, normalizedText]);

  const record = await repos.aiIntake.createPackage({
    organizationId: params.organizationId,
    learnerId: params.learnerId ?? null,
    title,
    modality: params.input.modality,
    status: "ready",
    normalizedText,
    sourceFingerprint,
    metadata: {
      note: params.input.note?.trim() || null,
      rawText: inputText,
      detectedChunks,
      summary,
      extractionMethod: "direct_input",
    },
  });

  return mapPackage(record, []);
}

export async function createAssetBackedIntakeSourcePackage(params: {
  organizationId: string;
  learnerId?: string | null;
  modality: Extract<IntakeSourcePackageModality, "photo" | "image" | "pdf" | "file">;
  fileName: string;
  mimeType: string;
  byteSize?: number | null;
  buffer: Buffer;
  note?: string | null;
}) {
  const repos = getRepositories();
  const initialTitle = titleFromText(params.note?.trim() || params.fileName);
  const packageRecord = await repos.aiIntake.createPackage({
    organizationId: params.organizationId,
    learnerId: params.learnerId ?? null,
    title: initialTitle,
    modality: params.modality,
    status: "draft",
    normalizedText: "",
    metadata: {
      note: params.note?.trim() || null,
      originalFileName: params.fileName,
    },
  });

  try {
    const safeFileName = sanitizeFileName(params.fileName);
    const storagePath = buildOrganizationStoragePath(
      params.organizationId,
      "intake-packages",
      packageRecord.id,
      safeFileName,
    );

    const storage = getAdminStorageClient().from(storageBuckets.learnerUploads);
    const upload = await storage.upload(storagePath, params.buffer, {
      cacheControl: "3600",
      contentType: params.mimeType,
      upsert: true,
    });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const extracted = await extractAssetText({
      modality: params.modality,
      mimeType: params.mimeType,
      fileName: params.fileName,
      note: params.note,
    });
    const normalizedText = combineNormalizedText([
      extracted.extractedText,
      params.note?.trim() || null,
    ]);

    if (!normalizedText) {
      throw new Error("This upload did not produce usable text context.");
    }

    const detectedChunks = buildDetectedChunks(normalizedText);
    const summary = summarizePackage({
      modality: params.modality,
      normalizedText,
      assetCount: 1,
    });
    const title = titleFromText(params.note?.trim() || extracted.extractedText || params.fileName);
    const sourceFingerprint = buildFingerprint([
      params.modality,
      normalizedText,
      params.fileName,
      String(params.byteSize ?? 0),
    ]);

    await repos.aiIntake.createAsset({
      packageId: packageRecord.id,
      storageBucket: storageBuckets.learnerUploads,
      storagePath,
      fileName: params.fileName,
      mimeType: params.mimeType,
      byteSize: params.byteSize ?? null,
      extractionStatus: extracted.extractionStatus,
      extractedText: extracted.extractedText,
      metadata: {
        extractionMethod: extracted.extractionMethod,
      },
    });

    await repos.aiIntake.updatePackage(packageRecord.id, {
      title,
      status: "ready",
      normalizedText,
      sourceFingerprint,
      metadata: {
        note: params.note?.trim() || null,
        detectedChunks,
        summary,
        extractionMethod: extracted.extractionMethod,
        originalFileName: params.fileName,
      },
    });
  } catch (error) {
    await repos.aiIntake.updatePackage(packageRecord.id, {
      status: "failed",
      metadata: {
        note: params.note?.trim() || null,
        error: error instanceof Error ? error.message : "Package creation failed.",
        originalFileName: params.fileName,
      },
    });
    throw error;
  }

  return getNormalizedIntakeSourcePackage(packageRecord.id);
}
