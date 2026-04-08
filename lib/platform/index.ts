export { getPlatformConfig } from "@/lib/platform/config";
export {
  ensureOrganizationPlatformSettings,
  getOrganizationPlatformSettings,
  getPlatformLabel,
  getTemplateDefaults,
} from "@/lib/platform/settings";
export { getInngestDevServerUrl, getInngestServePath } from "@/lib/platform/inngest";
export {
  createBrowserSupabaseClient,
  createServerSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/platform/supabase";
export { trackOperationalError, trackProductEvent } from "@/lib/platform/observability";
