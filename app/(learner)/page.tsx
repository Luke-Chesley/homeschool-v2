/**
 * Learner home — shows assigned activity sessions.
 */

import * as React from "react";
import Link from "next/link";
import { Clock, BookOpen, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listSessions } from "@/lib/activities/session-service";
import type { ActivitySession } from "@/lib/activities/types";

const DEMO_LEARNER_ID = "learner-demo";

const kindLabels: Record<string, string> = {
  quiz: "Quiz",
  flashcards: "Flashcards",
  matching: "Matching",
  sequencing: "Sequencing",
  guided_practice: "Guided Practice",
  reflection: "Reflection",
  hybrid_layout: "Lesson",
};

const statusColors: Record<string, string> = {
  not_started: "text-muted-foreground",
  in_progress: "text-amber-600",
  completed: "text-emerald-600",
  skipped: "text-muted-foreground line-through",
};

function SessionCard({ session }: { session: ActivitySession }) {
  const isCompleted = session.status === "completed";

  return (
    <Link href={`/activity/${session.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-2">
            <CardTitle className="text-base flex-1">
              {session.definition.title}
            </CardTitle>
            {isCompleted && <CheckCircle className="size-5 text-emerald-500 shrink-0" />}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs capitalize">
            {kindLabels[session.definition.kind] ?? session.definition.kind}
          </Badge>
          {session.estimatedMinutes && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              ~{session.estimatedMinutes} min
            </span>
          )}
          <span className={`ml-auto text-xs capitalize ${statusColors[session.status]}`}>
            {session.status.replace("_", " ")}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function LearnerHomePage() {
  const sessions = await listSessions(DEMO_LEARNER_ID);

  const notStarted = sessions.filter((s) => s.status === "not_started");
  const inProgress = sessions.filter((s) => s.status === "in_progress");
  const completed = sessions.filter((s) => s.status === "completed");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Your Activities
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete your assigned activities for today.
        </p>
      </div>

      {inProgress.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-amber-700">In Progress</h2>
          <div className="flex flex-col gap-3">
            {inProgress.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}

      {notStarted.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold">To Do</h2>
          <div className="flex flex-col gap-3">
            {notStarted.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-emerald-700">Completed</h2>
          <div className="flex flex-col gap-3">
            {completed.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}

      {sessions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/70 py-16 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No activities assigned yet.</p>
        </div>
      )}
    </div>
  );
}
