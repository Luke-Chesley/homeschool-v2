import "server-only";

import type { InferSelectModel } from "drizzle-orm";

import { createRepositories } from "@/lib/db";
import { ensureLocalDemoData } from "@/lib/db/fixtures/local-demo-persistence";
import { getDb } from "@/lib/db/server";
import { conversationThreads, conversationMessages, copilotActions } from "@/lib/db/schema";
import type { ChatMessage, CopilotAction, CopilotContext } from "./types";

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

type ThreadRecord = InferSelectModel<typeof conversationThreads>;
type MessageRecord = InferSelectModel<typeof conversationMessages>;
type ActionRecord = InferSelectModel<typeof copilotActions>;

function getCopilotRepo() {
  return createRepositories(getDb()).copilot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIsoString(value: Date | string) {
  return typeof value === "string" ? value : value.toISOString();
}

function getThreadContext(thread: ThreadRecord): CopilotContext | undefined {
  if (isRecord(thread.metadata) && isRecord(thread.metadata.context)) {
    return thread.metadata.context as CopilotContext;
  }

  return undefined;
}

function mapMessage(message: MessageRecord): ChatMessage {
  return {
    role: message.role as ChatMessage["role"],
    content: message.content,
    createdAt: toIsoString(message.createdAt),
  };
}

function getDomainActionStatus(action: ActionRecord): CopilotAction["status"] {
  if (isRecord(action.metadata) && typeof action.metadata.domainStatus === "string") {
    const domainStatus = action.metadata.domainStatus;
    if (
      domainStatus === "pending" ||
      domainStatus === "applied" ||
      domainStatus === "dismissed"
    ) {
      return domainStatus;
    }
  }

  if (action.status === "completed") {
    return "applied";
  }

  if (action.status === "failed") {
    return "dismissed";
  }

  return "pending";
}

function mapDbActionStatus(status: CopilotAction["status"]): ActionRecord["status"] {
  switch (status) {
    case "applied":
      return "completed";
    case "dismissed":
      return "failed";
    default:
      return "queued";
  }
}

function mapAction(action: ActionRecord): CopilotAction {
  const metadata = isRecord(action.metadata) ? action.metadata : {};

  return {
    id: action.id,
    kind: action.actionType as CopilotAction["kind"],
    label:
      typeof metadata.label === "string"
        ? metadata.label
        : action.targetType ?? action.actionType,
    payload: isRecord(action.input) ? action.input : {},
    status: getDomainActionStatus(action),
    createdAt: toIsoString(action.createdAt),
    lineageId: typeof metadata.lineageId === "string" ? metadata.lineageId : undefined,
  };
}

function getScopeType(context?: CopilotContext): ThreadRecord["scopeType"] {
  if (context?.lessonId) {
    return "lesson_session";
  }

  if (context?.learnerId) {
    return "learner";
  }

  return "organization";
}

class DbCopilotStore {
  private async hydrateSession(thread: ThreadRecord): Promise<CopilotSession> {
    const [messages, actions] = await Promise.all([
      getCopilotRepo().listMessagesForThread(thread.id),
      getCopilotRepo().listActionsForThread(thread.id),
    ]);

    return {
      id: thread.id,
      householdId: thread.organizationId,
      title: thread.title ?? "New conversation",
      messages: messages.map(mapMessage),
      context: getThreadContext(thread),
      actions: actions.map(mapAction),
      createdAt: toIsoString(thread.createdAt),
      updatedAt: toIsoString(thread.updatedAt),
    };
  }

  async createSession(
    householdId: string,
    title: string,
    context?: CopilotContext
  ): Promise<CopilotSession> {
    await ensureLocalDemoData();

    const thread = await getCopilotRepo().createThread({
      organizationId: householdId,
      learnerId: context?.learnerId ?? null,
      planId: null,
      planDayId: null,
      lessonSessionId: context?.lessonId ?? null,
      scopeType: getScopeType(context),
      title,
      metadata: {
        context: context ?? {},
      },
    });

    return this.hydrateSession(thread);
  }

  async getSession(id: string): Promise<CopilotSession | null> {
    await ensureLocalDemoData();

    const thread = await getCopilotRepo().findThreadById(id);
    return thread ? this.hydrateSession(thread) : null;
  }

  async listSessions(householdId: string): Promise<CopilotSession[]> {
    await ensureLocalDemoData();

    const threads = await getCopilotRepo().listThreadsForOrganization(householdId);
    return Promise.all(threads.map((thread) => this.hydrateSession(thread)));
  }

  async appendMessage(sessionId: string, message: ChatMessage): Promise<CopilotSession> {
    await ensureLocalDemoData();

    const thread = await getCopilotRepo().findThreadById(sessionId);
    if (!thread) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await getCopilotRepo().createMessage({
      threadId: sessionId,
      role: message.role,
      authorAdultUserId: null,
      content: message.content,
      structuredContent: {},
      model: null,
      promptVersion: null,
      metadata: {},
    });
    const updatedThread = await getCopilotRepo().updateThread(sessionId, {});

    return this.hydrateSession(updatedThread ?? thread);
  }

  async appendAction(
    sessionId: string,
    action: Omit<CopilotAction, "id" | "createdAt" | "status">
  ): Promise<CopilotAction> {
    await ensureLocalDemoData();

    const thread = await getCopilotRepo().findThreadById(sessionId);
    if (!thread) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const created = await getCopilotRepo().createAction({
      threadId: sessionId,
      messageId: null,
      actionType: action.kind,
      status: "queued",
      targetType: action.label,
      targetId: null,
      input: action.payload,
      output: {},
      metadata: {
        label: action.label,
        lineageId: action.lineageId ?? null,
        domainStatus: "pending",
      },
    });
    await getCopilotRepo().updateThread(sessionId, {});

    return mapAction(created);
  }

  async updateActionStatus(
    sessionId: string,
    actionId: string,
    status: CopilotAction["status"]
  ): Promise<CopilotAction> {
    await ensureLocalDemoData();

    const thread = await getCopilotRepo().findThreadById(sessionId);
    if (!thread) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const action = await getCopilotRepo().findActionById(actionId);
    if (!action || action.threadId !== sessionId) {
      throw new Error(`Action not found: ${actionId}`);
    }

    const metadata = isRecord(action.metadata) ? action.metadata : {};
    const updated = await getCopilotRepo().updateAction(actionId, {
      status: mapDbActionStatus(status),
      metadata: {
        ...metadata,
        domainStatus: status,
      },
    });
    await getCopilotRepo().updateThread(sessionId, {});

    if (!updated) {
      throw new Error(`Action not found: ${actionId}`);
    }

    return mapAction(updated);
  }
}

let _store: DbCopilotStore | null = null;

export function getCopilotStore(): DbCopilotStore {
  if (!_store) {
    _store = new DbCopilotStore();
  }

  return _store;
}
