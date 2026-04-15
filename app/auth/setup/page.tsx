import { redirect } from "next/navigation";

import { AuthSetupForm } from "@/components/auth/AuthSetupForm";
import { buildPathWithNext, sanitizeNextPath } from "@/lib/auth/next";
import { getAppAuthState } from "@/lib/app-session/server";

export const metadata = {
  title: "Create workspace",
};

export default async function AuthSetupPage(props: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const nextParam = typeof searchParams.next === "string" ? searchParams.next : undefined;
  const nextPath = sanitizeNextPath(nextParam, "/onboarding");
  const state = await getAppAuthState();

  if (state.status === "signed_out") {
    redirect(buildPathWithNext("/auth/login", nextPath));
  }

  if (state.status === "ready") {
    redirect(nextPath);
  }

  const displayName = state.authUser.fullName?.trim() || state.authUser.email?.split("@")[0] || "Household";
  const defaultOrganizationName = `${displayName.replace(/'s$/, "")} Homeschool`;

  return (
    <AuthSetupForm
      defaultOrganizationName={defaultOrganizationName}
      email={state.authUser.email}
    />
  );
}
