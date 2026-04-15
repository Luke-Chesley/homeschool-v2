import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  isAppApiSessionError,
  requireAppApiSession,
} from "@/lib/app-session/server";
import {
  createAssetBackedIntakeSourcePackage,
  createTextIntakeSourcePackage,
} from "@/lib/homeschool/intake/service";
import { CreateTextIntakeSourcePackageRequestSchema } from "@/lib/homeschool/intake/types";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackOperationalError, trackProductEvent } from "@/lib/platform/observability";

const AssetBackedModalitySchema = z.enum(["photo", "image", "pdf", "file"]);

export async function POST(request: NextRequest) {
  try {
    const session = await requireAppApiSession({ requireLearner: false });
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);
      const parsed = CreateTextIntakeSourcePackageRequestSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid intake package request.", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const pkg = await createTextIntakeSourcePackage({
        organizationId: session.organization.id,
        learnerId: session.activeLearner?.id ?? null,
        input: parsed.data,
      });

      await trackProductEvent({
        name: ACTIVATION_EVENT_NAMES.intakePackageCreated,
        organizationId: session.organization.id,
        learnerId: session.activeLearner?.id ?? null,
        metadata: {
          packageId: pkg.id,
          modality: pkg.modality,
          assetCount: pkg.assetCount,
          extractionStatus: pkg.extractionStatus,
        },
      });

      return NextResponse.json(pkg, { status: 201 });
    }

    const formData = await request.formData();
    const modalityRaw = formData.get("modality");
    const file = formData.get("file");
    const noteRaw = formData.get("note");

    const modality = AssetBackedModalitySchema.safeParse(modalityRaw);
    if (!modality.success) {
      return NextResponse.json({ error: "A valid upload modality is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
    }

    const note =
      typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim() : null;

    const pkg = await createAssetBackedIntakeSourcePackage({
      organizationId: session.organization.id,
      learnerId: session.activeLearner?.id ?? null,
      modality: modality.data,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      byteSize: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
      note,
    });

    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.intakePackageCreated,
      organizationId: session.organization.id,
      learnerId: session.activeLearner?.id ?? null,
      metadata: {
        packageId: pkg.id,
        modality: pkg.modality,
        assetCount: pkg.assetCount,
        extractionStatus: pkg.extractionStatus,
      },
    });

    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.intakeAssetUploaded,
      organizationId: session.organization.id,
      learnerId: session.activeLearner?.id ?? null,
      metadata: {
        packageId: pkg.id,
        modality: pkg.modality,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
      },
    });

    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    if (isAppApiSessionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    console.error("[api/homeschool/intake-package POST]", error);
    trackOperationalError({
      source: "api/homeschool/intake-package",
      message: error instanceof Error ? error.message : "Intake package creation failed.",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Intake package creation failed." },
      { status: 500 },
    );
  }
}
