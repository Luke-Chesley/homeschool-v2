import { redirect } from "next/navigation";

import { AuthSetupForm } from "@/components/auth/AuthSetupForm";
import { getAppAuthState } from "@/lib/app-session/server";

export const metadata = {
  title: "Create workspace",
};

export default async function AuthSetupPage() {
  const state = await getAppAuthState();

  if (state.status === "signed_out") {
    redirect("/auth/login");
  }

  if (state.status === "ready") {
    redirect("/");
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
