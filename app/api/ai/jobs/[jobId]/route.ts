import { NextRequest, NextResponse } from "next/server";

import { getAiGenerationJob, processAiGenerationJob } from "@/lib/ai/task-service";
import { requireAppSession } from "@/lib/app-session/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const session = await requireAppSession();
  const job = await getAiGenerationJob(jobId);

  if (!job || job.organizationId !== session.organization.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status === "queued") {
    await processAiGenerationJob(job.id);
  }

  const fresh = await getAiGenerationJob(job.id);

  return NextResponse.json({
    id: fresh?.id ?? job.id,
    taskName: fresh?.taskName ?? job.taskName,
    status: fresh?.status ?? job.status,
    artifactId: fresh?.artifactId ?? null,
    output: fresh?.output ?? {},
    errorMessage: fresh?.errorMessage ?? null,
    requestedAt: fresh?.requestedAt.toISOString() ?? job.requestedAt.toISOString(),
    completedAt: fresh?.completedAt?.toISOString() ?? null,
  });
}
