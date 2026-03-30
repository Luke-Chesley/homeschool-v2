import { createBrowserSupabaseClient, createServerSupabaseClient } from "@/lib/platform/supabase";
import { createServiceRoleSupabaseClient } from "@/lib/platform/supabase";

export function getBrowserStorageClient() {
  return createBrowserSupabaseClient().storage;
}

export function getServerStorageClient(accessToken?: string) {
  return createServerSupabaseClient({ accessToken }).storage;
}

export function getAdminStorageClient() {
  return createServiceRoleSupabaseClient().storage;
}
