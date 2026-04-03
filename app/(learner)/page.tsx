import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { listSessions } from "@/lib/activities/session-service";
import type { ActivitySession } from "@/lib/activities/types";

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
  in_progress: "text-amber-700",
  completed: "text-emerald-700",
  skipped: "text-muted-foreground line-through",
};

function SessionCard({ session }: { session: ActivitySession }) {
  const isCompleted = session.status === "completed";
  const isInProgress = session.status === "in_progress";

  return (
    <Link href={`/activity/${session.id}`}>
      <Card className="transition-colors hover:bg-muted/30">
        <div className="flex items-center justify-between gap-3 p-5">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {kindLabels[session.definition.kind] ?? session.definition.kind}
              </Badge>
              {session.estimatedMinutes ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {session.estimatedMinutes} min
                </span>
              ) : null}
            </div>
            <p className="font-serif text-xl leading-tight">{session.definition.title}</p>
            <p className={`text-sm capitalize ${statusColors[session.status]}`}>
              {session.status.replace("_", " ")}
            </p>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            {isCompleted ? <CheckCircle className="size-5 text-emerald-600" /> : null}
            {isInProgress ? <span className="text-sm font-medium text-amber-700">Resume</span> : null}
            {!isCompleted && !isInProgress ? <ArrowRight className="size-4" /> : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default async function LearnerHomePage() {
  const session = await requireAppSession();
  const sessions = await listSessions(session.activeLearner.id);

  const notStarted = sessions.filter((s) => s.status === "not_started");
  const inProgress = sessions.filter((s) => s.status === "in_progress");
  const completed = sessions.filter((s) => s.status === "completed");

  return (
    <div className="space-y-8">
      <div className="border-b border-border/70 pb-4">
        <p className="text-sm text-muted-foreground">Daily view</p>
        <h1 className="font-serif text-3xl tracking-tight">Today</h1>
      </div>

      {inProgress.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-medium text-amber-700">In progress</h2>
          <div className="flex flex-col gap-3">
            {inProgress.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      ) : null}

      {notStarted.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-medium">Up next</h2>
          <div className="flex flex-col gap-3">
            {notStarted.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      ) : null}

      {completed.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-medium text-emerald-700">Done</h2>
          <div className="flex flex-col gap-3">
            {completed.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      ) : null}

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 py-16 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No activities assigned yet.</p>
        </div>
      ) : null}
    </div>
  );
}
