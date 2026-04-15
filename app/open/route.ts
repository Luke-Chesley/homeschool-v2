import { NextRequest, NextResponse } from "next/server";

import { getAppAuthState, setWorkspaceCookies } from "@/lib/app-session/server";
import {
  parseMobileShellIntent,
  resolveMobileShellRedirect,
} from "@/lib/mobile/shell";

export async function GET(request: NextRequest) {
  const intent = parseMobileShellIntent(request.nextUrl.searchParams);
  const state = await getAppAuthState();
  const resolution = await resolveMobileShellRedirect(state, intent);
  const response = NextResponse.redirect(new URL(resolution.redirectPath, request.url));

  if (resolution.authStatus === "ready" && resolution.organizationId) {
    return setWorkspaceCookies({
      response,
      organizationId: resolution.organizationId,
      learnerId: resolution.learnerId,
    });
  }

  return response;
}
