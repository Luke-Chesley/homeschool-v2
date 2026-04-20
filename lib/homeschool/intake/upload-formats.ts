import type { IntakeSourcePackageModality } from "./types";

type UploadLike = {
  name: string;
  type?: string | null;
};

const COMMON_IMAGE_UPLOAD_ACCEPT_PARTS = [
  "image/*",
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
];

const COMMON_FILE_UPLOAD_ACCEPT_PARTS = [
  "application/pdf",
  ".pdf",
  "text/plain",
  ".txt",
  "text/markdown",
  ".md",
  ".markdown",
  "application/json",
  ".json",
  "text/html",
  ".html",
  ".htm",
  "text/xml",
  "application/xml",
  ".xml",
  "text/csv",
  "application/csv",
  ".csv",
  "text/tsv",
  ".tsv",
  "application/msword",
  ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".docx",
  "application/rtf",
  "text/rtf",
  ".rtf",
  "application/vnd.oasis.opendocument.text",
  ".odt",
  "application/vnd.ms-powerpoint",
  ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pptx",
  "application/vnd.ms-excel",
  ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsx",
];

const OPENAI_VISION_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const OPENAI_VISION_IMAGE_EXTENSIONS = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

export const COMMON_SOURCE_UPLOAD_ACCEPT = [
  ...COMMON_IMAGE_UPLOAD_ACCEPT_PARTS,
  ...COMMON_FILE_UPLOAD_ACCEPT_PARTS,
].join(",");

export function normalizeUploadMimeType(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function fileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
}

export function isImageLikeUpload(file: UploadLike) {
  const mimeType = normalizeUploadMimeType(file.type);
  if (mimeType.startsWith("image/")) {
    return true;
  }

  return [
    ".avif",
    ".bmp",
    ".gif",
    ".heic",
    ".heif",
    ".jpeg",
    ".jpg",
    ".png",
    ".svg",
    ".tif",
    ".tiff",
    ".webp",
  ].includes(fileExtension(file.name));
}

export function isPdfUpload(file: UploadLike) {
  const mimeType = normalizeUploadMimeType(file.type);
  return mimeType === "application/pdf" || fileExtension(file.name) === ".pdf";
}

export function resolveUploadModality(
  file: UploadLike,
  source: "camera" | "upload" = "upload",
): Exclude<IntakeSourcePackageModality, "text" | "outline"> {
  if (source === "camera") {
    return "photo";
  }

  if (isImageLikeUpload(file)) {
    return "image";
  }

  if (isPdfUpload(file)) {
    return "pdf";
  }

  return "file";
}

export function supportsOpenAiVisionImageInput(file: UploadLike) {
  const mimeType = normalizeUploadMimeType(file.type);
  if (OPENAI_VISION_IMAGE_MIME_TYPES.has(mimeType)) {
    return true;
  }

  return OPENAI_VISION_IMAGE_EXTENSIONS.has(fileExtension(file.name));
}

export function canonicalOpenAiVisionImageMimeType(file: UploadLike) {
  const mimeType = normalizeUploadMimeType(file.type);
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return "image/jpeg";
  }
  if (mimeType === "image/png" || mimeType === "image/webp" || mimeType === "image/gif") {
    return mimeType;
  }

  switch (fileExtension(file.name)) {
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return null;
  }
}

export function replaceFileExtension(fileName: string, nextExtension: string) {
  const trimmed = fileName.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  const normalizedExtension = nextExtension.startsWith(".") ? nextExtension : `.${nextExtension}`;
  if (dotIndex < 0) {
    return `${trimmed || "upload"}${normalizedExtension}`;
  }
  return `${trimmed.slice(0, dotIndex)}${normalizedExtension}`;
}
