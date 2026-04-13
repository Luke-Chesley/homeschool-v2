import { redirect } from "next/navigation";

import { AuthCredentialsForm } from "@/components/auth/AuthCredentialsForm";
import { getAppAuthState } from "@/lib/app-session/server";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const state = await getAppAuthState();

  if (state.status === "ready") {
    redirect("/today");
  }

  if (state.status === "needs_setup") {
    redirect("/auth/setup");
  }

  return <AuthCredentialsForm mode="login" />;
}
