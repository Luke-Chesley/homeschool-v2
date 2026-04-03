import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/app-session/server";
import { listFrameworks } from "@/lib/standards/service";

export async function GET() {
  try {
    const session = await requireAppSession();
    const frameworks = await listFrameworks({
      organizationId: session.organization.id,
    });
    return NextResponse.json(frameworks);
  } catch (error) {
    console.error("[api/standards/frameworks GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
