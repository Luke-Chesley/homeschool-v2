import { z } from "zod";

import { AI_LAUNCH_SUPPORTED_MODALITIES } from "@/lib/homeschool/ai-launch-contract";

export const IntakeSourcePackageModalitySchema = z.enum(AI_LAUNCH_SUPPORTED_MODALITIES);
export const IntakeSourcePackageStatusSchema = z.enum(["draft", "ready", "failed"]);
export const IntakeSourceAssetExtractionStatusSchema = z.enum([
  "pending",
  "ready",
  "requires_review",
  "failed",
]);

export const IntakeSourceAssetSchema = z.object({
  id: z.string().min(1),
  packageId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  storageBucket: z.string().min(1),
  storagePath: z.string().min(1),
  byteSize: z.number().int().nonnegative().nullable().optional(),
  extractionStatus: IntakeSourceAssetExtractionStatusSchema,
  extractedText: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const NormalizedIntakeSourcePackageSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  learnerId: z.string().nullable().optional(),
  title: z.string().min(1),
  modality: IntakeSourcePackageModalitySchema,
  status: IntakeSourcePackageStatusSchema,
  normalizedText: z.string(),
  note: z.string().nullable().optional(),
  sourceFingerprint: z.string().nullable().optional(),
  detectedChunks: z.array(z.string()).default([]),
  summary: z.string().min(1),
  assetCount: z.number().int().nonnegative(),
  extractionStatus: IntakeSourceAssetExtractionStatusSchema,
  assets: z.array(IntakeSourceAssetSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type IntakeSourcePackageModality = z.infer<typeof IntakeSourcePackageModalitySchema>;
export type IntakeSourcePackageStatus = z.infer<typeof IntakeSourcePackageStatusSchema>;
export type IntakeSourceAssetExtractionStatus = z.infer<
  typeof IntakeSourceAssetExtractionStatusSchema
>;
export type IntakeSourceAsset = z.infer<typeof IntakeSourceAssetSchema>;
export type NormalizedIntakeSourcePackage = z.infer<typeof NormalizedIntakeSourcePackageSchema>;

export const CreateTextIntakeSourcePackageRequestSchema = z.object({
  modality: z.enum(["text", "outline"]),
  text: z.string().trim().min(1).max(12_000),
  note: z.string().trim().max(2_000).optional(),
});

export type CreateTextIntakeSourcePackageRequest = z.infer<
  typeof CreateTextIntakeSourcePackageRequestSchema
>;
