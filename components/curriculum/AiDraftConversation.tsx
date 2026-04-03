"use client";

import * as React from "react";
import { ArrowRight, RefreshCcw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChatInput } from "@/components/copilot/ChatInput";
import {
  type CurriculumAiChatMessage,
  type CurriculumAiChatTurn,
  type CurriculumAiCreateResponse,
  type CurriculumAiIntakeState,
} from "@/lib/curriculum/ai-draft";
import { cn } from "@/lib/utils";

interface Props {
  activeLearner: {
    displayName: string;
    firstName: string;
  };
  onCreatedSourceId: (sourceId: string) => void;
  onCancel: () => void;
}

export function AiDraftConversation({
  activeLearner,
  onCreatedSourceId,
  onCancel,
}: Props) {
  const [messages, setMessages] = React.useState<CurriculumAiChatMessage[]>([]);
  const [state, setState] = React.useState<CurriculumAiIntakeState | null>(null);
  const [loadingInitial, setLoadingInitial] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const bootstrappedRef = React.useRef(false);

  React.useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }
    bootstrappedRef.current = true;
    void requestAssistantTurn([]);
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state]);

  async function requestAssistantTurn(nextMessages: CurriculumAiChatMessage[]) {
    if (nextMessages.length === 0) {
      setLoadingInitial(true);
    } else {
      setSending(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/curriculum/ai-draft/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to continue the curriculum conversation.");
      }

      const payload = (await response.json()) as CurriculumAiChatTurn;
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: payload.assistantMessage,
        },
      ]);
      setState(payload.state);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to continue the curriculum conversation.",
      );
    } finally {
      setLoadingInitial(false);
      setSending(false);
    }
  }

  async function handleSend(content: string) {
    const userMessage: CurriculumAiChatMessage = {
      role: "user",
      content,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    await requestAssistantTurn(nextMessages);
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/curriculum/ai-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate the curriculum.");
      }

      const payload = (await response.json()) as CurriculumAiCreateResponse;
      onCreatedSourceId(payload.sourceId);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to generate the curriculum.",
      );
      setCreating(false);
    }
  }

  function handleRestart() {
    bootstrappedRef.current = true;
    setMessages([]);
    setState(null);
    setError(null);
    setLoadingInitial(true);
    setSending(false);
    setCreating(false);
    void requestAssistantTurn([]);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-primary/15 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1 rounded-full">
              <Sparkles className="size-3" />
              AI curriculum builder
            </Badge>
            <Badge variant="outline" className="rounded-full">
              Planning for {activeLearner.displayName}
            </Badge>
            {state ? (
              <Badge variant="outline" className="rounded-full capitalize">
                {state.readiness === "ready" ? "Ready to generate" : "Intake in progress"}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="font-serif text-xl font-semibold tracking-tight">
              Build the curriculum through conversation
            </p>
            <p className="text-sm text-muted-foreground">
              The AI should ask follow-up questions as it learns about goals, pacing, readiness,
              structure, and constraints. When the intake is strong enough, it will generate the
              curriculum tree and lesson outline.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_320px]">
        <Card className="min-h-[520px]">
          <CardContent className="flex h-full flex-col p-0">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {loadingInitial ? (
                <ConversationBubble
                  role="assistant"
                  content={`Thinking through the first question for ${activeLearner.firstName}…`}
                  loading
                />
              ) : null}

              {messages.map((message, index) => (
                <ConversationBubble
                  key={`${message.role}-${index}`}
                  role={message.role}
                  content={message.content}
                />
              ))}

              {sending ? (
                <ConversationBubble
                  role="assistant"
                  content="Working on the next question…"
                  loading
                />
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            {error ? (
              <div className="px-5 pb-4">
                <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              </div>
            ) : null}

            <div className="border-t border-border/60 p-4">
              <ChatInput
                onSend={handleSend}
                disabled={loadingInitial || sending || creating}
                placeholder="Tell the AI what you want this curriculum to do…"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Intake status
                </p>
                <p className="text-sm text-muted-foreground">
                  {state?.summary ??
                    "The AI is gathering enough context to structure a real curriculum."}
                </p>
              </div>

              <CapturedSection
                label="Topic"
                value={state?.capturedRequirements.topic}
              />
              <CapturedSection
                label="Goals"
                value={state?.capturedRequirements.goals}
              />
              <CapturedSection
                label="Pacing"
                value={state?.capturedRequirements.timeframe}
              />
              <CapturedSection
                label="Learner"
                value={state?.capturedRequirements.learnerProfile}
              />
              <CapturedSection
                label="Constraints"
                value={state?.capturedRequirements.constraints}
              />
              <CapturedSection
                label="Structure"
                value={state?.capturedRequirements.structurePreferences}
              />

              {state?.missingInformation?.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Still unclear</p>
                  <div className="flex flex-wrap gap-2">
                    {state.missingInformation.map((item) => (
                      <Badge key={item} variant="outline" className="rounded-full capitalize">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1">
                <p className="text-sm font-medium">Generate the curriculum</p>
                <p className="text-sm text-muted-foreground">
                  This will create the source, normalized node tree, and a unit-and-lesson outline.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || sending || loadingInitial || state?.readiness !== "ready"}
                >
                  {creating ? "Generating curriculum…" : "Generate curriculum"}
                  <ArrowRight className="size-4" />
                </Button>
                <Button type="button" variant="outline" onClick={handleRestart} disabled={creating}>
                  <RefreshCcw className="size-4" />
                  Restart conversation
                </Button>
                <Button type="button" variant="ghost" onClick={onCancel} disabled={creating}>
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ConversationBubble({
  role,
  content,
  loading = false,
}: {
  role: "assistant" | "user";
  content: string;
  loading?: boolean;
}) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isUser ? "bg-primary/15 text-primary" : "bg-secondary/35 text-secondary-foreground",
        )}
      >
        {isUser ? "You" : "AI"}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "border-primary/20 bg-primary/10"
            : "border-border/70 bg-card",
          !isUser && "whitespace-pre-wrap",
        )}
      >
        {content}
        {loading ? (
          <span className="ml-1 inline-block size-2 animate-pulse rounded-full bg-primary/60" />
        ) : null}
      </div>
    </div>
  );
}

function CapturedSection({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-sm text-muted-foreground">
        {value?.trim() || "Still being clarified in the conversation."}
      </p>
    </div>
  );
}
