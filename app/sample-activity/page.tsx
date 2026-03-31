import { redirect } from "next/navigation";

import { requireAppSession } from "@/lib/app-session/server";
import { listSessions } from "@/lib/activities/session-service";

export const metadata = {
  title: "Sample Activity",
};

export default async function SampleActivityPage() {
  const session = await requireAppSession();
  const activitySessions = await listSessions(session.activeLearner.id);
  const firstSession = activitySessions.find((activitySession) => activitySession.status !== "skipped");

  if (!firstSession) {
    redirect("/users");
  }

  redirect(`/activity/${firstSession.id}`);
}
