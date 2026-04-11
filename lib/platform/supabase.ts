import "@/lib/server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";

type ClientOptions = {
  accessToken?: string;
};

type CookieOptions = Parameters<NextResponse["cookies"]["set"]>[2];

type CookieMutation = {
  name: string;
  value: string;
  options?: CookieOptions;
};

type SupabaseCookieMutation = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function buildServerClientOptions({ accessToken }: ClientOptions = {}) {
  return {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  };
}

export function createServerSupabaseClient(options: ClientOptions = {}) {
  const env = getServerEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    buildServerClientOptions(options),
  );
}

export async function createServerSupabaseSsrClient() {
  const env = getServerEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieMutation[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot write cookies. Middleware handles refresh writes.
        }
      },
    },
  });
}

export function createRouteHandlerSupabaseClient(request: NextRequest) {
  const env = getServerEnv();
  const pendingCookies: CookieMutation[] = [];

  const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieMutation[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  function applyCookies<T extends NextResponse>(response: T) {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  return {
    client,
    applyCookies,
  };
}

export function createServiceRoleSupabaseClient() {
  const env = getServerEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    buildServerClientOptions(),
  );
}
