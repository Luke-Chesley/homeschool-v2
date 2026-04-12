import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireAppSession } from "@/lib/app-session/server";
import { listSessions } from "@/lib/activities/session-service";
import type { ActivitySession } from "@/lib/activities/types";
import { cn } from "@/lib/utils";

const kindLabels: Record<string, string> = {
  quiz: "Quiz",
  flashcards: "Flashcards",
  matching: "Matching",
  sequencing: "Sequencing",
  guided_practice: "Guided Practice",
  reflection: "Reflection",
  checklist: "Checklist",
  rubric_response: "Rubric Response",
  file_submission: "File Submission",
  supervisor_sign_off: "Sign-off",
  hybrid_layout: "Lesson",
};

function getSessionKind(session: ActivitySession) {
  const definition = session.definition as unknown as {
    kind?: string;
    activityKind?: string;
  };

  return definition.kind ?? definition.activityKind ?? "activity";
}

function getSessionKindLabel(session: ActivitySession) {
  const kind = getSessionKind(session);
  return kindLabels[kind] ?? kind.replaceAll("_", " ");
}

function dedupeSessionsById(sessions: ActivitySession[]) {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    if (seen.has(session.id)) {
      return false;
    }

    seen.add(session.id);
    return true;
  });
}

function SessionActionLabel({ session }: { session: ActivitySession }) {
  if (session.status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
        <CheckCircle2 className="size-4" />
        Completed
      </span>
    );
  }

  if (session.status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        <RotateCcw className="size-4" />
        Resume
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
      Start
      <ArrowRight className="size-4" />
    </span>
  );
}

function SessionCard({ session }: { session: ActivitySession }) {
  return (
    <Link
      href={`/activity/${session.id}`}
      className={cn(
        "learner-queue-card block",
        session.status === "completed" && "border-primary/25 bg-primary/5",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2.5">
          <div className="learner-toolbar text-xs text-muted-foreground">
            <Badge variant="outline">{getSessionKindLabel(session)}</Badge>
            {session.estimatedMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3.5" />
                {session.estimatedMinutes} min
              </span>
            ) : null}
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-2xl leading-tight tracking-tight text-foreground">
              {session.definition.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {session.status === "in_progress"
                ? "Keep going where you left off."
                : session.status === "completed"
                  ? "This session is finished and saved."
                  : "Open this session to begin."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <SessionActionLabel session={session} />
        </div>
      </div>
    </Link>
  );
}

function QueueSection({
  title,
  sessions,
  emptyMessage,
}: {
  title: string;
  sessions: ActivitySession[];
  emptyMessage?: string;
}) {
  if (sessions.length === 0 && !emptyMessage) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="learner-section-label">{title}</h2>
      {sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      ) : (
        <div className="learner-reading-surface">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}

export default async function LearnerHomePage() {
  const session = await requireAppSession();
  const sessions = dedupeSessionsById(await listSessions(session.activeLearner.id));
  const activityLabel = session.platformSettings.activityLabel.toLowerCase();
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  const inProgress = sessions.filter((item) => item.status === "in_progress");
  const notStarted = sessions.filter((item) => item.status === "not_started");
  const completed = sessions.filter((item) => item.status === "completed");
  const nextSession = inProgress[0] ?? notStarted[0] ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-border/70 pb-4">
        <p className="section-meta">{dateLabel}</p>
        <div className="space-y-2">
          <h1 className="font-serif text-4xl leading-tight tracking-tight">Today</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Start the next piece of work from here. Everything for today stays in one queue.
          </p>
        </div>
        <div className="learner-toolbar text-sm text-muted-foreground">
          <span>{sessions.length} sessions</span>
          {nextSession?.estimatedMinutes ? <span>{nextSession.estimatedMinutes} min next</span> : null}
        </div>
      </header>

      {nextSession ? (
        <section className="learner-reading-surface">
          <div className="learner-reading-column space-y-5">
            <div className="space-y-2">
              <p className="learner-section-label">
                {nextSession.status === "in_progress" ? "Continue now" : "Ready to begin"}
              </p>
              <h2 className="font-serif text-3xl leading-tight tracking-tight">
                {nextSession.definition.title}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {nextSession.status === "in_progress"
                  ? "Pick up where you left off and keep moving through today’s work."
                  : "Open the next session and move into the activity surface."}
              </p>
            </div>

            <div className="learner-toolbar text-sm text-muted-foreground">
              <Badge variant="outline">{getSessionKindLabel(nextSession)}</Badge>
              {nextSession.estimatedMinutes ? (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-4" />
                  {nextSession.estimatedMinutes} min
                </span>
              ) : null}
            </div>

            <div className="learner-toolbar">
              <Link
                href={`/activity/${nextSession.id}`}
                className={buttonVariants({ size: "sm" })}
              >
                {nextSession.status === "in_progress" ? "Resume session" : "Start session"}
              </Link>
              <Link
                href="/today"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                View workspace
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {sessions.length > 0 ? (
        <div className="space-y-6">
          <QueueSection title="In progress" sessions={inProgress} />
          <QueueSection title="Up next" sessions={notStarted} />
          <QueueSection title="Completed" sessions={completed} />
        </div>
      ) : (
        <div className="learner-reading-surface text-center">
          <div className="learner-reading-column flex flex-col items-center gap-4 py-6">
            <BookOpen className="size-8 text-muted-foreground/50" />
            <div className="space-y-2">
              <h2 className="font-serif text-2xl tracking-tight">Nothing is queued yet.</h2>
              <p className="text-sm text-muted-foreground">
                There is no {activityLabel} work assigned right now.
              </p>
            </div>
            <Link href="/today" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open workspace
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
