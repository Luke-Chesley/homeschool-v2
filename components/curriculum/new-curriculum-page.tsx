"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

import { AiDraftConversation } from "@/components/curriculum/AiDraftConversation";
import { HomeschoolCurriculumIntakeForm } from "@/components/curriculum/homeschool-curriculum-intake-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NewCurriculumClientPage({
  activeLearner,
  organizationId,
  defaultSchoolYearLabel,
  initialEntry,
}: {
  activeLearner: {
    id: string;
    displayName: string;
    firstName: string;
  };
  organizationId: string;
  defaultSchoolYearLabel?: string | null;
  initialEntry?: "source" | "conversation";
}) {
  const router = useRouter();
  const [entry, setEntry] = React.useState<"source" | "conversation">(initialEntry ?? "source");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/curriculum">
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="space-y-1">
            <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              Add a source
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
              Start from material you already have, or talk through the plan live before you
              generate anything for {activeLearner.firstName}.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant={entry === "source" ? "default" : "outline"}
          onClick={() => setEntry("source")}
        >
          Source intake
        </Button>
        <Button
          variant={entry === "conversation" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setEntry("conversation")}
        >
          <Sparkles className="size-4" />
          Conversation builder
        </Button>
      </div>

      {entry === "source" ? (
        <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle>Choose an entry point</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <HomeschoolCurriculumIntakeForm
              organizationId={organizationId}
              activeLearnerId={activeLearner.id}
              activeLearnerName={activeLearner.displayName}
              defaultSchoolYearLabel={defaultSchoolYearLabel}
            />
          </CardContent>
        </Card>
      ) : (
        <AiDraftConversation
          activeLearner={activeLearner}
          onCreatedSourceId={(sourceId) => {
            router.push(`/curriculum/${sourceId}`);
            router.refresh();
          }}
          onCancel={() => setEntry("source")}
        />
      )}
    </div>
  );
}
