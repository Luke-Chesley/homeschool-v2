import { redirect } from "next/navigation";

import { LandingPage } from "@/components/marketing/landing-page";
import { getAppAuthState } from "@/lib/app-session/server";

export default async function HomePage() {
  const state = await getAppAuthState();

  if (state.status === "ready") {
    redirect("/today");
  }

  if (state.status === "needs_setup") {
    redirect("/onboarding");
  }

  return <LandingPage />;
}
