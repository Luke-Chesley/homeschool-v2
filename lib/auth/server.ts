import "@/lib/server-only";

import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { createServerSupabaseClient, createServerSupabaseSsrClient } from "@/lib/platform/supabase";

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

// Deduplicate the auth-user lookup across a single server render/request.
const getCachedRequestAuthUser = cache(async (): Promise<User | null> => {
  const client = await createServerSupabaseSsrClient();
  const { data: userData, error: userError } = await client.auth.getUser();

  if (userError || !userData.user) {
    return null;
  }

  return userData.user;
});

export async function getRequestAuthSession(): Promise<{ user: User | null }> {
  return {
    user: await getCachedRequestAuthUser(),
  };
}

export async function requireAuthenticatedUser() {
  const { user } = await getRequestAuthSession();
  return user;
}
