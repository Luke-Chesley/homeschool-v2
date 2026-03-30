import { z } from "zod";

export const appEnvironmentSchema = z.enum(["local", "hosted"]);

export const publicEnvSchema = z.object({
  APP_ENV: appEnvironmentSchema.default("local"),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export function formatEnvIssues(issues: z.ZodIssue[]) {
  return issues
    .map((issue) => {
      const path = issue.path.join(".") || "root";
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}
