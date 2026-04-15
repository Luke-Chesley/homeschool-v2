import { redirect } from "next/navigation";

import { AuthCredentialsForm } from "@/components/auth/AuthCredentialsForm";
import { buildPathWithNext, sanitizeNextPath } from "@/lib/auth/next";
import { getAppAuthState } from "@/lib/app-session/server";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const nextParam = typeof searchParams.next === "string" ? searchParams.next : undefined;
  const nextPath = sanitizeNextPath(nextParam, "/today");
  const state = await getAppAuthState();

  if (state.status === "ready") {
    redirect(nextPath);
  }

  if (state.status === "needs_setup") {
    redirect(buildPathWithNext("/auth/setup", nextPath));
  }

  return <AuthCredentialsForm mode="login" />;
}
