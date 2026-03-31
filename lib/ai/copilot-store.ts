import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";

import type { ChatMessage, CopilotAction, CopilotContext } from "./types";

// ---------------------------------------------------------------------------
// Chat session
// ---------------------------------------------------------------------------

export interface CopilotSession {
  id: string;
  householdId: string;
  title: string;
  messages: ChatMessage[];
  context?: CopilotContext;
  actions: CopilotAction[];
  createdAt: string;
  updatedAt: string;
}

class DbCopilotStore {
  async createSession(
    householdId: string,
    title: string,
    context?: CopilotContext
  ): Promise<CopilotSession> {
    const thread = await createRepositories(getDb()).copilot.createThread({
      organizationId: householdId,
      learnerId: context?.learnerId ?? null,
      planId: null,
      planDayId: null,
      lessonSessionId: context?.lessonId ?? null,
      scopeType: context?.learnerId ? "learner" : "organization",
      title,
      metadata: {
        context: context ?? {},
      },
    });

    return {
      id: thread.id,
      householdId,
      title: thread.title ?? title,
      messages: [],
      context,
      actions: [],
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    };
  }

  async getSession(id: string): Promise<CopilotSession | null> {
    const repos = createRepositories(getDb());
    const thread = await repos.copilot.getThread(id);
    if (!thread) return null;

    const [messages, actions] = await Promise.all([
      repos.copilot.listMessagesForThread(id),
      repos.copilot.listActionsForThread(id),
    ]);

    return {
      id: thread.id,
      householdId: thread.organizationId,
      title: thread.title ?? "Conversation",
      messages: messages.map((message) => ({
        role: message.role as ChatMessage["role"],
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
      context: (thread.metadata?.context as CopilotContext | undefined) ?? undefined,
      actions: actions.map((action) => ({
        id: action.id,
        kind: action.actionType as CopilotAction["kind"],
        label: action.targetType ?? action.actionType,
        payload: (action.input ?? {}) as Record<string, unknown>,
        status:
          action.status === "completed"
            ? "applied"
            : action.status === "failed"
              ? "dismissed"
              : "pending",
        createdAt: action.createdAt.toISOString(),
      })),
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    };
  }

  async listSessions(householdId: string): Promise<CopilotSession[]> {
    const threads = await createRepositories(getDb()).copilot.listThreadsForOrganization(householdId);
    return threads.map((thread) => ({
      id: thread.id,
      householdId: thread.organizationId,
      title: thread.title ?? "Conversation",
      messages: [],
      context: (thread.metadata?.context as CopilotContext | undefined) ?? undefined,
      actions: [],
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    }));
  }

  async appendMessage(sessionId: string, message: ChatMessage): Promise<CopilotSession> {
    const repos = createRepositories(getDb());
    const thread = await repos.copilot.getThread(sessionId);
    if (!thread) throw new Error(`Session not found: ${sessionId}`);

    await repos.copilot.createMessage({
      threadId: sessionId,
      role: message.role,
      authorAdultUserId: null,
      content: message.content,
      structuredContent: {},
      model: null,
      promptVersion: null,
      metadata: {},
    });

    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return session;
  }

  async appendAction(
    sessionId: string,
    action: Omit<CopilotAction, "id" | "createdAt" | "status">
  ): Promise<CopilotAction> {
    const created = await createRepositories(getDb()).copilot.createAction({
      threadId: sessionId,
      messageId: null,
      actionType: action.kind,
      status: "queued",
      targetType: action.label,
      targetId: null,
      input: action.payload,
      output: {},
      metadata: {},
    });

    return {
      id: created.id,
      kind: action.kind,
      label: action.label,
      payload: action.payload,
      status: "pending",
      createdAt: created.createdAt.toISOString(),
    };
  }

  async updateActionStatus(
    sessionId: string,
    actionId: string,
    status: CopilotAction["status"]
  ): Promise<CopilotAction> {
    await createRepositories(getDb()).copilot.getThread(sessionId);
    const action = await createRepositories(getDb()).copilot.updateActionStatus(
      actionId,
      status === "applied" ? "completed" : status === "dismissed" ? "failed" : "queued",
    );

    return {
      id: action.id,
      kind: action.actionType as CopilotAction["kind"],
      label: action.targetType ?? action.actionType,
      payload: (action.input ?? {}) as Record<string, unknown>,
      status,
      createdAt: action.createdAt.toISOString(),
    };
  }
}

let _store: DbCopilotStore | null = null;

export function getCopilotStore(): DbCopilotStore {
  if (!_store) _store = new DbCopilotStore();
  return _store;
}
