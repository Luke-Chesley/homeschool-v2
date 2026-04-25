"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lightbulb, Sparkles } from "lucide-react";

import { AiDraftConversation } from "@/components/curriculum/AiDraftConversation";
import { CurriculumIdeaBuilder } from "@/components/curriculum/curriculum-idea-builder";
import { HomeschoolCurriculumIntakeForm } from "@/components/curriculum/homeschool-curriculum-intake-form";
import { Button } from "@/components/ui/button";

type CurriculumEntry = "source" | "conversation" | "idea";

export function NewCurriculumClientPage({
  activeLearner,
  organizationId,
  initialEntry,
}: {
  activeLearner: {
    id: string;
    displayName: string;
    firstName: string;
  };
  organizationId: string;
  initialEntry?: CurriculumEntry;
}) {
  const router = useRouter();
  const [entry, setEntry] = React.useState<CurriculumEntry>(initialEntry ?? "source");
  const [sourceStarter, setSourceStarter] = React.useState("");
  const [conversationStarter, setConversationStarter] = React.useState("");

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
              Add curriculum
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
              Paste source material, build a guided idea, or talk through the plan live before you
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
          Use source material
        </Button>
        <Button
          variant={entry === "conversation" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setEntry("conversation")}
        >
          <Sparkles className="size-4" />
          Conversation builder
        </Button>
        <Button
          variant={entry === "idea" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setEntry("idea")}
        >
          <Lightbulb className="size-4" />
          Build from idea
        </Button>
      </div>

      {entry === "source" ? (
        <HomeschoolCurriculumIntakeForm
          key={sourceStarter}
          organizationId={organizationId}
          activeLearnerId={activeLearner.id}
          activeLearnerName={activeLearner.displayName}
          initialCurriculumText={sourceStarter}
        />
      ) : null}

      {entry === "idea" ? (
        <CurriculumIdeaBuilder
          title="Build the curriculum sentence"
          description="Pick a few blanks, then send the sentence into source intake or use it to start the conversation builder."
          primaryActionLabel="Use as source"
          showConversationAction
          onUseIdea={(idea) => {
            setSourceStarter(idea);
            setEntry("source");
          }}
          onStartConversation={(idea) => {
            setConversationStarter(idea);
            setEntry("conversation");
          }}
        />
      ) : null}

      {entry === "conversation" ? (
        <AiDraftConversation
          key={conversationStarter}
          activeLearner={activeLearner}
          initialUserMessage={conversationStarter}
          onCreatedSourceId={(sourceId) => {
            router.push(`/curriculum/${sourceId}`);
            router.refresh();
          }}
          onCancel={() => setEntry("source")}
        />
      ) : null}
    </div>
  );
}
