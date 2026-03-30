import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getClientEnv } from "@/lib/env/client";
import { getServerEnv } from "@/lib/env/server";

type ClientOptions = {
  accessToken?: string;
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

let browserClient: SupabaseClient | undefined;

export function createBrowserSupabaseClient() {
  if (browserClient) {
    return browserClient;
  }

  const env = getClientEnv();
  browserClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    },
  );

  return browserClient;
}

export function createServerSupabaseClient(options: ClientOptions = {}) {
  const env = getServerEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    buildServerClientOptions(options),
  );
}

export function createServiceRoleSupabaseClient() {
  const env = getServerEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    buildServerClientOptions(),
  );
}
