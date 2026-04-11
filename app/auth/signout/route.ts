import { NextRequest, NextResponse } from "next/server";

import { clearWorkspaceCookies } from "@/lib/app-session/server";
import { createRouteHandlerSupabaseClient } from "@/lib/platform/supabase";

async function signOut(request: NextRequest) {
  const { client, applyCookies } = createRouteHandlerSupabaseClient(request);
  await client.auth.signOut();

  const response = NextResponse.redirect(new URL("/auth/login", request.url));
  clearWorkspaceCookies(response);
  return applyCookies(response);
}

export async function GET(request: NextRequest) {
  return signOut(request);
}

export async function POST(request: NextRequest) {
  return signOut(request);
}
