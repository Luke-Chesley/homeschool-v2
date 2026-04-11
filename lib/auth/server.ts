import "@/lib/server-only";

import type { Session, User } from "@supabase/supabase-js";

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

export async function getRequestAuthSession(): Promise<{ session: Session | null; user: User | null }> {
  const client = await createServerSupabaseSsrClient();
  const [{ data: sessionData }, { data: userData, error: userError }] = await Promise.all([
    client.auth.getSession(),
    client.auth.getUser(),
  ]);

  if (userError || !userData.user) {
    return {
      session: null,
      user: null,
    };
  }

  return {
    session: sessionData.session,
    user: userData.user,
  };
}

export async function requireAuthenticatedUser() {
  const { user } = await getRequestAuthSession();
  return user;
}
