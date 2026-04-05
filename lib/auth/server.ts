import "@/lib/server-only";

import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/platform/supabase";

export function getServerAuthClient(accessToken?: string) {
  return createServerSupabaseClient({ accessToken });
}

export async function getServerUser(accessToken?: string): Promise<User | null> {
  if (!accessToken) {
    return null;
  }

  const client = getServerAuthClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);

  if (error) {
    return null;
  }

  return data.user;
}
