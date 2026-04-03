"use client";

import * as React from "react";
import { Sparkles, RotateCcw, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildCurriculumAiDraftQuestions,
  type CurriculumAiDraft,
  type CurriculumAiDraftAnswer,
  type CurriculumAiDraftQuestionId,
  type CurriculumAiDraftResponse,
} from "@/lib/curriculum/ai-draft";
import { cn } from "@/lib/utils";

type AnswerMap = Partial<Record<CurriculumAiDraftQuestionId, string>>;

interface Props {
  householdId: string;
  activeLearner: {
    displayName: string;
    firstName: string;
  };
  onCreate: (data: {
    householdId: string;
    title: string;
    description: string;
    kind: "ai_draft";
    subjects: string[];
    gradeLevels: string[];
    academicYear?: string;
  }) => void;
  onCancel: () => void;
}

export function AiDraftConversation({
  householdId,
  activeLearner,
  onCreate,
  onCancel,
}: Props) {
  const questions = buildCurriculumAiDraftQuestions(activeLearner.firstName);
  const [answers, setAnswers] = React.useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [draftInput, setDraftInput] = React.useState("");
  const [generatedDraft, setGeneratedDraft] = React.useState<CurriculumAiDraft | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currentQuestion = currentIndex < questions.length ? questions[currentIndex] : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentQuestion) {
      return;
    }

    const trimmed = draftInput.trim();
    if (!trimmed) {
      return;
    }

    const nextAnswers = {
      ...answers,
      [currentQuestion.id]: trimmed,
    };

    setAnswers(nextAnswers);
    setDraftInput("");
    setError(null);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((value) => value + 1);
      return;
    }

    setCurrentIndex(questions.length);
    await generateDraft(nextAnswers);
  }

  async function generateDraft(nextAnswers: AnswerMap) {
    setIsGenerating(true);
    setGeneratedDraft(null);

    try {
      const answerPayload = questions
        .map((question) => {
          const answer = nextAnswers[question.id]?.trim();
          if (!answer) {
            return null;
          }

          return {
            questionId: question.id,
            answer,
          } satisfies CurriculumAiDraftAnswer;
        })
        .filter((entry): entry is CurriculumAiDraftAnswer => entry !== null);

      const response = await fetch("/api/curriculum/ai-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: answerPayload,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to build curriculum draft.");
      }

      const payload = (await response.json()) as CurriculumAiDraftResponse;
      setGeneratedDraft(payload.draft);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to build curriculum draft.",
      );
      setCurrentIndex(questions.length - 1);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleRestart() {
    setAnswers({});
    setCurrentIndex(0);
    setDraftInput("");
    setGeneratedDraft(null);
    setIsGenerating(false);
    setError(null);
  }

  function handleCreate() {
    if (!generatedDraft) {
      return;
    }

    onCreate({
      householdId,
      title: generatedDraft.title,
      description: generatedDraft.description,
      kind: "ai_draft",
      subjects: generatedDraft.subjects,
      gradeLevels: generatedDraft.gradeLevels,
      academicYear: generatedDraft.academicYear,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-primary/15 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1 rounded-full">
              <Sparkles className="size-3" />
              AI draft
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Planning for {activeLearner.displayName}
            </Badge>
            {!generatedDraft && currentQuestion ? (
              <Badge variant="outline" className="rounded-full">
                Step {currentIndex + 1} of {questions.length}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="font-serif text-xl font-semibold tracking-tight">
              Shape the plan before generating the draft
            </p>
            <p className="text-sm text-muted-foreground">
              This intake asks about goals, pacing, prior knowledge, and constraints so the draft
              starts from sound teaching decisions instead of just a topic prompt.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {questions.map((question, index) => {
          const answer = answers[question.id];
          const isAnswered = typeof answer === "string";
          const isCurrent = !generatedDraft && !isGenerating && index === currentIndex;

          if (!isAnswered && !isCurrent) {
            return null;
          }

          return (
            <React.Fragment key={question.id}>
              <ConversationBubble
                speaker="assistant"
                title={question.prompt}
                body={question.helperText}
              />
              {isAnswered ? (
                <ConversationBubble
                  speaker="parent"
                  title="Parent"
                  body={answer}
                />
              ) : null}
            </React.Fragment>
          );
        })}

        {isGenerating ? (
          <ConversationBubble
            speaker="assistant"
            title="Drafting the curriculum brief"
            body={`Pulling ${activeLearner.firstName}'s goals, pace, and constraints into a first pass.`}
            loading
          />
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {generatedDraft ? (
        <Card className="border-border/70">
          <CardContent className="space-y-5 p-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                First draft
              </p>
              <div className="space-y-1">
                <h3 className="font-serif text-2xl font-semibold tracking-tight">
                  {generatedDraft.title}
                </h3>
                <p className="text-sm text-muted-foreground">{generatedDraft.summary}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {generatedDraft.subjects.map((subject) => (
                <Badge key={subject} variant="secondary" className="capitalize">
                  {subject}
                </Badge>
              ))}
              {generatedDraft.gradeLevels.map((gradeLevel) => (
                <Badge key={gradeLevel} variant="outline">
                  Grade {gradeLevel}
                </Badge>
              ))}
              {generatedDraft.academicYear ? (
                <Badge variant="outline">{generatedDraft.academicYear}</Badge>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <DraftList
                title="Why this shape"
                items={generatedDraft.rationale}
              />
              <DraftList
                title="What success looks like"
                items={generatedDraft.successSignals}
              />
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
              <p className="text-sm font-medium">Teaching approach</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {generatedDraft.teachingApproach}
              </p>
              {generatedDraft.parentNotes.length > 0 ? (
                <DraftList
                  title="Parent notes"
                  items={generatedDraft.parentNotes}
                  className="mt-4"
                />
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                Back
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleRestart}>
                <RotateCcw className="size-4" />
                Start over
              </Button>
              <Button type="button" size="sm" onClick={handleCreate}>
                Create curriculum
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!generatedDraft ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <textarea
              value={draftInput}
              onChange={(event) => setDraftInput(event.target.value)}
              disabled={isGenerating || !currentQuestion}
              rows={4}
              placeholder={currentQuestion?.placeholder}
              className="w-full resize-none border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {currentQuestion?.suggestedReplies?.length ? (
            <div className="flex flex-wrap gap-2">
              {currentQuestion.suggestedReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => setDraftInput(reply)}
                  className="rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
                >
                  {reply}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Back
            </Button>
            <Button type="submit" size="sm" disabled={isGenerating || !draftInput.trim()}>
              {currentIndex === questions.length - 1 ? "Draft curriculum" : "Continue"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ConversationBubble({
  speaker,
  title,
  body,
  loading = false,
}: {
  speaker: "assistant" | "parent";
  title: string;
  body: string;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex max-w-[90%] flex-col gap-1 rounded-2xl border px-4 py-3 text-sm shadow-sm",
        speaker === "assistant"
          ? "border-border/70 bg-card"
          : "ml-auto border-primary/20 bg-primary/10",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <p className="leading-relaxed text-foreground">
        {body}
        {loading ? <span className="ml-1 inline-block size-2 animate-pulse rounded-full bg-primary/60" /> : null}
      </p>
    </div>
  );
}

function DraftList({
  title,
  items,
  className,
}: {
  title: string;
  items: string[];
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">{title}</p>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="rounded-xl border border-border/60 bg-card/70 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
