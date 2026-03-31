import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ParentShell } from "@/components/parent-shell/parent-shell";
import { getAppSession } from "@/lib/app-session/server";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const session = await getAppSession();

  if (!session.activeLearner) {
    redirect("/users");
  }

  return <ParentShell activeLearnerName={session.activeLearner.displayName}>{children}</ParentShell>;
}
