import { createBrowserSupabaseClient } from "@/lib/platform/supabase-browser";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/platform/supabase";

export function getBrowserStorageClient() {
  return createBrowserSupabaseClient().storage;
}

export function getServerStorageClient(accessToken?: string) {
  return createServerSupabaseClient({ accessToken }).storage;
}

export function getAdminStorageClient() {
  return createServiceRoleSupabaseClient().storage;
}
