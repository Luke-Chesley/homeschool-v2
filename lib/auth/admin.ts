import "@/lib/server-only";

import { createServiceRoleSupabaseClient } from "@/lib/platform/supabase";

export function getAdminAuthClient() {
  return createServiceRoleSupabaseClient();
}
