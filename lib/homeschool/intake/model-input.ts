import "@/lib/server-only";

import sharp from "sharp";

import {
  canonicalOpenAiVisionImageMimeType,
  normalizeUploadMimeType,
  replaceFileExtension,
  supportsOpenAiVisionImageInput,
} from "./upload-formats";

export function buildBase64DataUrl(bytes: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export async function normalizeImageForVisionModel(params: {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
}) {
  const mimeType = normalizeUploadMimeType(params.mimeType);
  const imageFile = {
    name: params.fileName,
    type: mimeType,
  };

  if (supportsOpenAiVisionImageInput(imageFile)) {
    return {
      bytes: params.bytes,
      fileName: params.fileName,
      mimeType: canonicalOpenAiVisionImageMimeType(imageFile) ?? "image/png",
      normalized: false,
    };
  }

  const transformed = await sharp(params.bytes, {
    animated: false,
    density: 300,
    pages: 1,
  })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();

  return {
    bytes: transformed,
    fileName: replaceFileExtension(params.fileName, ".png"),
    mimeType: "image/png",
    normalized: true,
  };
}
