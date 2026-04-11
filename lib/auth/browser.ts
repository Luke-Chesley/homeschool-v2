import { createBrowserSupabaseClient } from "@/lib/platform/supabase-browser";

export function getBrowserAuthClient() {
  return createBrowserSupabaseClient();
}
