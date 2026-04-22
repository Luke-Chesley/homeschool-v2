"use client";

import * as React from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import type { CurriculumSourceStatus } from "@/lib/curriculum/types";

export function CurriculumGenerationNotice(props: {
  sourceId: string;
  sourceTitle: string;
  status: CurriculumSourceStatus;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (props.status !== "draft") {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [props.status, router]);

  if (props.status === "failed_import") {
    return (
      <Card className="border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive shadow-none">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Could not finish building {props.sourceTitle}.</p>
            <p className="text-destructive/80">
              The source was saved, but curriculum generation failed. You can retry from this source later.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (props.status === "active") {
    return (
      <Card className="border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-none dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">{props.sourceTitle} is ready.</p>
            <p className="text-emerald-800/80 dark:text-emerald-100/80">
              The new curriculum finished generating and is now available for planning.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-primary/15 bg-primary/5 px-4 py-3 text-sm text-foreground shadow-none">
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
        <div className="space-y-1">
          <p className="font-medium">Generating {props.sourceTitle}.</p>
          <p className="text-muted-foreground">
            The source has been saved and named. We&apos;re building the curriculum now and this page will refresh automatically.
          </p>
        </div>
      </div>
    </Card>
  );
}
