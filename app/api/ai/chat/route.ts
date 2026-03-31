/**
 * POST /api/ai/chat
 *
 * Streaming chat endpoint for the copilot.
 * Returns a Server-Sent Event (text/event-stream) response with delta chunks.
 *
 * Uses Vercel AI SDK conventions for the SSE format so the client-side
 * useChat hook can consume it.
 *
 * Integration point: wire up real provider adapters in lib/ai/registry.ts.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAppSession } from "@/lib/app-session/server";
import { streamChatAnswer } from "@/lib/ai/task-service";
import { getCopilotStore } from "@/lib/ai/copilot-store";
import type { ChatMessage, CopilotContext } from "@/lib/ai/types";

const RequestSchema = z.object({
  sessionId: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
  context: z
    .object({
      learnerId: z.string().optional(),
      learnerName: z.string().optional(),
      curriculumSourceId: z.string().optional(),
      lessonId: z.string().optional(),
      standardIds: z.array(z.string()).default([]),
      goalIds: z.array(z.string()).default([]),
      recentOutcomes: z
        .array(z.object({ title: z.string(), status: z.string(), date: z.string() }))
        .default([]),
    })
    .optional(),
});

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
  if (!activeSessionId) {
    const session = await store.createSession(
      appSession.organization.id,
      messages.find((m) => m.role === "user")?.content?.slice(0, 60) ?? "New conversation",
      {
        learnerId: context?.learnerId ?? appSession.activeLearner.id,
        learnerName: context?.learnerName ?? appSession.activeLearner.displayName,
        curriculumSourceId: context?.curriculumSourceId,
        lessonId: context?.lessonId,
        standardIds: context?.standardIds ?? [],
        goalIds: context?.goalIds ?? [],
        recentOutcomes: context?.recentOutcomes ?? [],
      }
    );
    activeSessionId = session.id;
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    await store.appendMessage(activeSessionId, lastUserMessage as ChatMessage);
  }

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ sessionId: activeSessionId })}\n\n`)
        );

        for await (const delta of streamChatAnswer({
          messages: messages as ChatMessage[],
          context: context as CopilotContext | undefined,
        })) {
          fullResponse += delta;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        }

        await store.appendMessage(activeSessionId!, {
          role: "assistant",
          content: fullResponse,
          createdAt: new Date().toISOString(),
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err) {
        console.error("[api/ai/chat] Streaming error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`)
        );
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
