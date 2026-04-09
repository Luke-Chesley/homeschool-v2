import "@/lib/server-only";

import { z } from "zod";

import type { ChatMessage, CopilotContext } from "@/lib/ai/types";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation, previewLearningCoreOperation } from "./operations";

const CopilotChatArtifactSchema = z.object({
  answer: z.string().min(1),
});

export async function previewCopilotChat(params: {
  messages: ChatMessage[];
  context?: CopilotContext;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return previewLearningCoreOperation(
    "copilot_chat",
    buildLearningCoreEnvelope({
      input: {
        messages: params.messages,
        context: params.context ?? null,
      },
      surface: "copilot",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      requestOrigin: "copilot",
      debug: true,
      presentationContext: {
        audience: "internal",
        displayIntent: "preview",
        shouldReturnPromptPreview: true,
      },
    }),
  );
}

export async function executeCopilotChat(params: {
  messages: ChatMessage[];
  context?: CopilotContext;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return executeLearningCoreOperation(
    "copilot_chat",
    buildLearningCoreEnvelope({
      input: {
        messages: params.messages,
        context: params.context ?? null,
      },
      surface: "copilot",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      requestOrigin: "copilot",
      presentationContext: {
        audience: "parent",
        displayIntent: "final",
      },
    }),
    CopilotChatArtifactSchema,
  );
}
