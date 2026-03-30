import { getPlatformConfig } from "@/lib/platform/config";

export function getInngestServePath() {
  return getPlatformConfig().inngest.servePath;
}

export function getInngestDevServerUrl() {
  return getPlatformConfig().inngest.baseUrl;
}
