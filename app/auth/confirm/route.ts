import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/lib/platform/supabase";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") || "/";
  const { client, applyCookies } = createRouteHandlerSupabaseClient(request);

  let error: Error | null = null;

  if (code) {
    const result = await client.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && type) {
    const result = await client.auth.verifyOtp({ token_hash: tokenHash, type });
    error = result.error;
  } else {
    error = new Error("Missing auth confirmation parameters.");
  }

  if (error) {
    const errorUrl = new URL("/auth/error", request.url);
    return applyCookies(NextResponse.redirect(errorUrl));
  }

  const destination = new URL(next, request.url);
  return applyCookies(NextResponse.redirect(destination));
}
