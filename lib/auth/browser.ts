import { createBrowserSupabaseClient } from "@/lib/platform/supabase";

export function getBrowserAuthClient() {
  return createBrowserSupabaseClient();
}
