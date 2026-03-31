import "server-only";

import type { InferSelectModel } from "drizzle-orm";

import { ensureLocalDemoData } from "@/lib/db/fixtures/local-demo-persistence";
import { getRepositories } from "@/lib/db/server";
import { conversationThreads, conversationMessages, copilotActions } from "@/lib/db/schema";
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

type ThreadRecord = InferSelectModel<typeof conversationThreads>;
type MessageRecord = InferSelectModel<typeof conversationMessages>;
type ActionRecord = InferSelectModel<typeof copilotActions>;

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

  return "pending";
}

function mapDbActionStatus(status: CopilotAction["status"]): ActionRecord["status"] {
  switch (status) {
    case "applied":
      return "completed";
    case "dismissed":
      return "completed";
    default:
      return "queued";
  }
}

function mapAction(action: ActionRecord): CopilotAction {
  const metadata = isRecord(action.metadata) ? action.metadata : {};

  return {
    id: action.id,
    kind: action.actionType as CopilotAction["kind"],
    label: typeof metadata.label === "string" ? metadata.label : action.actionType,
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
    const repos = await getRepositories();
    const [messages, actions] = await Promise.all([
      repos.copilot.listMessagesForThread(thread.id),
      repos.copilot.listActionsForThread(thread.id),
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

    const repos = await getRepositories();
    const thread = await repos.copilot.createThread({
      organizationId: householdId,
      learnerId: context?.learnerId,
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

    const repos = await getRepositories();
    const thread = await repos.copilot.findThreadById(id);
    return thread ? this.hydrateSession(thread) : null;
  }

  async listSessions(householdId: string): Promise<CopilotSession[]> {
    await ensureLocalDemoData();

    const repos = await getRepositories();
    const threads = await repos.copilot.listThreadsForOrganization(householdId);
    return Promise.all(threads.map((thread) => this.hydrateSession(thread)));
  }

  async appendMessage(sessionId: string, message: ChatMessage): Promise<CopilotSession> {
    await ensureLocalDemoData();

    const repos = await getRepositories();
    const thread = await repos.copilot.findThreadById(sessionId);
    if (!thread) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await repos.copilot.createMessage({
      threadId: sessionId,
      role: message.role,
      content: message.content,
      metadata: {},
    });
    const updatedThread = await repos.copilot.updateThread(sessionId, {});

    return this.hydrateSession(updatedThread ?? thread);
  }

  async appendAction(
    sessionId: string,
    action: Omit<CopilotAction, "id" | "createdAt" | "status">
  ): Promise<CopilotAction> {
    await ensureLocalDemoData();

    const repos = await getRepositories();
    const thread = await repos.copilot.findThreadById(sessionId);
    if (!thread) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const created = await repos.copilot.createAction({
      threadId: sessionId,
      actionType: action.kind,
      status: "queued",
      input: action.payload,
      metadata: {
        label: action.label,
        lineageId: action.lineageId ?? null,
        domainStatus: "pending",
      },
    });
    await repos.copilot.updateThread(sessionId, {});

    return mapAction(created);
  }

  async updateActionStatus(
    sessionId: string,
    actionId: string,
    status: CopilotAction["status"]
  ): Promise<CopilotAction> {
    await ensureLocalDemoData();

    const repos = await getRepositories();
    const thread = await repos.copilot.findThreadById(sessionId);
    if (!thread) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const action = await repos.copilot.findActionById(actionId);
    if (!action || action.threadId !== sessionId) {
      throw new Error(`Action not found: ${actionId}`);
    }

    const metadata = isRecord(action.metadata) ? action.metadata : {};
    const updated = await repos.copilot.updateAction(actionId, {
      status: mapDbActionStatus(status),
      metadata: {
        ...metadata,
        domainStatus: status,
      },
    });
    await repos.copilot.updateThread(sessionId, {});

    if (!updated) {
      throw new Error(`Action not found: ${actionId}`);
    }

    return mapAction(updated);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _store: DbCopilotStore | null = null;

export function getCopilotStore(): DbCopilotStore {
  if (!_store) _store = new DbCopilotStore();
  return _store;
}
