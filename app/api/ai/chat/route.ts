/**
 * POST /api/ai/chat
 *
 * Streaming chat endpoint for the copilot.
 * Returns a Server-Sent Event (text/event-stream) response with delta chunks.
 *
 * Uses Vercel AI SDK conventions for the SSE format so the client-side
 * useChat hook can consume it.
 *
 * The app no longer talks to model providers directly.
 * Streaming is simulated from a single learning-core operation result.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAppSession } from "@/lib/app-session/server";
import { getCopilotStore } from "@/lib/ai/copilot-store";
import { CopilotContextSchema } from "@/lib/ai/types";
import type { ChatMessage, CopilotContext } from "@/lib/ai/types";
import { executeCopilotChat } from "@/lib/learning-core/copilot";

const RequestSchema = z.object({
  sessionId: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
  context: CopilotContextSchema.optional(),
});

function chunkAssistantAnswer(text: string, maxChunkLength = 140) {
  const tokens = text.split(/(\s+)/).filter((token) => token.length > 0);
  const chunks: string[] = [];
  let current = "";

  for (const token of tokens) {
    if (current.length + token.length > maxChunkLength && current.trim().length > 0) {
      chunks.push(current);
      current = token;
      continue;
    }

    current += token;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [text];
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { sessionId, messages, context } = parsed.data;
  const appSession = await requireAppSession();

  const store = getCopilotStore();
  let activeSessionId = sessionId;
  const normalizedContext: CopilotContext = {
    learnerId: appSession.activeLearner.id,
    learnerName: appSession.activeLearner.displayName,
    curriculumSourceId: context?.curriculumSourceId,
    lessonId: context?.lessonId,
    standardIds: context?.standardIds ?? [],
    goalIds: context?.goalIds ?? [],
    curriculumSnapshot: context?.curriculumSnapshot,
    dailyWorkspaceSnapshot: context?.dailyWorkspaceSnapshot,
    weeklyPlanningSnapshot: context?.weeklyPlanningSnapshot,
    feedbackNotes: context?.feedbackNotes ?? [],
    recentOutcomes: context?.recentOutcomes ?? [],
  };
  if (activeSessionId) {
    const existing = await store.getSession(activeSessionId, {
      householdId: appSession.organization.id,
      learnerId: appSession.activeLearner.id,
    });
    if (!existing) {
      return new Response(JSON.stringify({ error: "Session not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  if (!activeSessionId) {
    const session = await store.createSession(
      appSession.organization.id,
      messages.find((m) => m.role === "user")?.content?.slice(0, 60) ?? "New conversation",
      normalizedContext
    );
    activeSessionId = session.id;
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    await store.appendMessage(activeSessionId, lastUserMessage as ChatMessage, {
      householdId: appSession.organization.id,
      learnerId: appSession.activeLearner.id,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        emit({ type: "session", sessionId: activeSessionId });

        const result = await executeCopilotChat({
          messages: messages as ChatMessage[],
          context: normalizedContext,
          organizationId: appSession.organization.id,
          learnerId: appSession.activeLearner.id,
        });

        const fullResponse = result.artifact.answer;

        await store.appendMessage(
          activeSessionId!,
          {
            role: "assistant",
            content: fullResponse,
            createdAt: new Date().toISOString(),
          },
          {
            householdId: appSession.organization.id,
            learnerId: appSession.activeLearner.id,
          },
        );

        const persistedActions = await Promise.all(
          result.artifact.actions.map((action) =>
            store.appendAction(
              activeSessionId!,
              action,
              {
                householdId: appSession.organization.id,
                learnerId: appSession.activeLearner.id,
              },
              { lineageId: result.trace.request_id },
            ),
          ),
        );

        for (const delta of chunkAssistantAnswer(fullResponse)) {
          emit({ type: "delta", delta });
        }

        if (persistedActions.length > 0) {
          emit({ type: "actions", actions: persistedActions });
        }

        emit({ type: "done" });
        controller.close();
      } catch (err) {
        console.error("[api/ai/chat] Streaming error:", err);
        emit({
          type: "error",
          error: err instanceof Error ? err.message : "Stream failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
