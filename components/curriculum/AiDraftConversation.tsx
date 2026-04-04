"use client";

import * as React from "react";
import { ArrowRight, RefreshCcw, Sparkles } from "lucide-react";

import { ChatInput } from "@/components/copilot/ChatInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const canGenerateDraft = state?.readiness === "ready" || userMessageCount >= 2;

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
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden border-primary/15 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6">
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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.7fr)] lg:items-end">
            <div className="space-y-2">
              <p className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
                Shape the curriculum through live intake
              </p>
              <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
                The AI should understand the learner, surface the real teaching goals, and then
                build a usable domain, strand, goal-group, skill, unit, and lesson structure from
                that conversation.
              </p>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-background/75 p-4 text-sm text-muted-foreground">
              Expect a back-and-forth, not a static wizard. The assistant should sharpen the scope,
              pacing, and progression before you generate anything.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,400px)]">
        <Card className="min-h-[680px] overflow-hidden border-border/70 shadow-sm">
          <CardContent className="flex h-full flex-col p-0">
            <div className="border-b border-border/60 bg-muted/15 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Conversation</p>
                <p className="text-sm text-muted-foreground">
                  Answer naturally. The AI should keep adapting the next question to what you have
                  already said.
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-muted/10 px-5 py-5 sm:px-6 sm:py-6">
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
              <div className="px-5 pb-4 pt-4 sm:px-6">
                <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              </div>
            ) : null}

            <div className="border-t border-border/60 bg-background p-4 sm:p-5">
              <ChatInput
                onSend={handleSend}
                disabled={loadingInitial || sending || creating}
                placeholder="Describe the curriculum you want to build, what matters, or what the AI should clarify next…"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="border-border/70 shadow-sm">
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

              <CapturedSection label="Topic" value={state?.capturedRequirements.topic} />
              <CapturedSection label="Goals" value={state?.capturedRequirements.goals} />
              <CapturedSection label="Pacing" value={state?.capturedRequirements.timeframe} />
              <CapturedSection label="Learner" value={state?.capturedRequirements.learnerProfile} />
              <CapturedSection
                label="Constraints"
                value={state?.capturedRequirements.constraints}
              />
              <CapturedSection
                label="Structure"
                value={state?.capturedRequirements.structurePreferences}
              />

              {Boolean(state?.missingInformation?.length) && state?.readiness !== "ready" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Still unclear</p>
                  <div className="flex flex-wrap gap-2">
                    {state?.missingInformation?.map((item) => (
                      <Badge key={item} variant="outline" className="rounded-full capitalize">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
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
                  disabled={creating || sending || loadingInitial || !canGenerateDraft}
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
          "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-sm",
          isUser ? "bg-primary/15 text-primary" : "bg-secondary/35 text-secondary-foreground",
        )}
      >
        {isUser ? "You" : "AI"}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-[22px] border px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[82%]",
          isUser ? "border-primary/20 bg-primary/10" : "border-border/70 bg-background",
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
