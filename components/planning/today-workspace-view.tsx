import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DailyWorkspace } from "@/lib/planning/types";

interface TodayWorkspaceViewProps {
  workspace: DailyWorkspace;
  sourceId?: string;
}

function formatMinutes(minutes: number) {
  return `${minutes} min`;
}

function formatPlannerDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function TodayWorkspaceView({ workspace, sourceId }: TodayWorkspaceViewProps) {
  if (workspace.items.length === 0) {
    return (
      <Card className="border-border/70 bg-card/88">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{formatPlannerDate(workspace.date)}</Badge>
            <Badge variant="secondary">{workspace.learner.name}</Badge>
          </div>
          <CardTitle>{workspace.headline}</CardTitle>
          <CardDescription>No route items are available for this learner and source yet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-7 text-muted-foreground">
            Import curriculum and generate a weekly route to populate today.
          </p>
          <Link href="/curriculum" className={buttonVariants({ variant: "default", size: "sm" })}>
            Open curriculum
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_320px]">
      <div className="grid gap-6">
        <Card className="border-border/70 bg-card/88">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{formatPlannerDate(workspace.date)}</Badge>
              <Badge variant="secondary">{workspace.learner.name}</Badge>
            </div>
            <CardTitle>{workspace.headline}</CardTitle>
            <CardDescription>
              Active source: {workspace.leadItem.sourceLabel}. This surface keeps the current route
              visible without surfacing the internal planning panels.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-border/70 bg-background/75 p-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Lead lesson
              </p>
              <p className="mt-2 font-serif text-2xl">{workspace.leadItem.title}</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {workspace.leadItem.objective}
              </p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/75 p-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Estimated time
              </p>
              <p className="mt-2 font-serif text-2xl">{formatMinutes(workspace.leadItem.estimatedMinutes)}</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Keep enough margin after the first block to leave the rest of the day steady.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/88">
          <CardHeader>
            <CardDescription>Execution lane</CardDescription>
            <CardTitle>What the day is asking for right now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {workspace.items.map((item) => (
              <div key={item.id} className="rounded-3xl border border-border/70 bg-background/75 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.subject}</Badge>
                  {item.status !== "ready" ? (
                    <Badge variant="outline">{item.status.replace("_", " ")}</Badge>
                  ) : null}
                  <Badge variant="outline" className="ml-auto">
                    {formatMinutes(item.estimatedMinutes)}
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="font-serif text-xl leading-tight sm:text-2xl">{item.title}</p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.objective}</p>
                </div>
                <div className="mt-4 rounded-2xl border border-border/70 bg-card/80 p-3">
                  <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Materials
                  </p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {item.materials.join(" · ")}
                  </p>
                </div>
                {item.curriculum ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/today?date=${workspace.date}${sourceId ? `&sourceId=${sourceId}` : ""}&action=complete&planItemId=${item.id}`}
                      className={buttonVariants({ variant: "default", size: "sm" })}
                    >
                      Mark complete
                    </Link>
                    <Link
                      href={`/today?date=${workspace.date}${sourceId ? `&sourceId=${sourceId}` : ""}&action=push_to_tomorrow&planItemId=${item.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Push to tomorrow
                    </Link>
                    {workspace.alternatesByPlanItemId[item.id]?.[0] ? (
                      <Link
                        href={`/today?date=${workspace.date}${sourceId ? `&sourceId=${sourceId}` : ""}&action=swap_with_alternate&planItemId=${item.id}&alternateWeeklyRouteItemId=${workspace.alternatesByPlanItemId[item.id][0].id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Swap with {workspace.alternatesByPlanItemId[item.id][0].skillTitle}
                      </Link>
                    ) : null}
                    <Link
                      href={`/today?date=${workspace.date}${sourceId ? `&sourceId=${sourceId}` : ""}&action=remove_today&planItemId=${item.id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Remove from today
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 self-start">
        <Card className="border-primary/15 bg-background/88">
          <CardHeader>
            <CardDescription>Prep checklist</CardDescription>
            <CardTitle>Before the first block</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspace.prepChecklist.map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-border/70 bg-card/75 p-4 text-sm leading-7 text-muted-foreground"
              >
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
