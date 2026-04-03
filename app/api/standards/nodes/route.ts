import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import { listStandards } from "@/lib/standards/service";

const StandardsQuerySchema = z.object({
  frameworkId: z.string().optional(),
  subject: z.string().optional(),
  gradeLevel: z.string().optional(),
  query: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAppSession();

    const parsed = StandardsQuerySchema.safeParse({
      frameworkId: req.nextUrl.searchParams.get("frameworkId") ?? undefined,
      subject: req.nextUrl.searchParams.get("subject") ?? undefined,
      gradeLevel: req.nextUrl.searchParams.get("gradeLevel") ?? undefined,
      query: req.nextUrl.searchParams.get("query") ?? undefined,
      parentId: req.nextUrl.searchParams.has("parentId")
        ? req.nextUrl.searchParams.get("parentId") === "root"
          ? null
          : req.nextUrl.searchParams.get("parentId")
        : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const standards = await listStandards(parsed.data);
    return NextResponse.json(standards);
  } catch (error) {
    console.error("[api/standards/nodes GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
