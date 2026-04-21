import { NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import {
  deleteActivityAttemptAsset,
  uploadActivityAttemptAsset,
} from "@/lib/activities/upload-service";
import {
  ActivityAssetComponentTypeSchema,
  ActivityAssetKindSchema,
  ActivityAttachmentEntrySchema,
  isStoredActivityAttachment,
} from "@/lib/activities/uploads";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;

  try {
    const formData = await req.formData();
    const componentId = formData.get("componentId");
    const componentType = ActivityAssetComponentTypeSchema.safeParse(formData.get("componentType"));
    const kind = ActivityAssetKindSchema.safeParse(formData.get("kind"));
    const file = formData.get("file");

    if (
      typeof componentId !== "string" ||
      componentId.trim().length === 0 ||
      !componentType.success ||
      !kind.success ||
      !(file instanceof File) ||
      file.size <= 0
    ) {
      return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
    }

    const session = await requireAppSession();
    const asset = await uploadActivityAttemptAsset({
      attemptId,
      learnerId: session.activeLearner.id,
      componentId: componentId.trim(),
      componentType: componentType.data,
      kind: kind.data,
      file,
    });

    return NextResponse.json(asset);
  } catch (err) {
    console.error("[api/activities/attempts/assets POST]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Could not upload the file.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;

  try {
    const body = await req.json();
    const componentType = ActivityAssetComponentTypeSchema.safeParse(body?.componentType);
    const kind = ActivityAssetKindSchema.safeParse(body?.kind);
    const asset = ActivityAttachmentEntrySchema.safeParse(body?.asset);

    if (
      typeof body?.componentId !== "string" ||
      body.componentId.trim().length === 0 ||
      !componentType.success ||
      !kind.success ||
      !asset.success ||
      !isStoredActivityAttachment(asset.data)
    ) {
      return NextResponse.json({ error: "Invalid removal request." }, { status: 400 });
    }

    const session = await requireAppSession();
    await deleteActivityAttemptAsset({
      attemptId,
      learnerId: session.activeLearner.id,
      componentId: body.componentId.trim(),
      componentType: componentType.data,
      kind: kind.data,
      asset: asset.data,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/activities/attempts/assets DELETE]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Could not remove the uploaded file.",
      },
      { status: 500 },
    );
  }
}
