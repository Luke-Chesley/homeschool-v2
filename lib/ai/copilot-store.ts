import "@/lib/server-only";

import type { InferSelectModel } from "drizzle-orm";

import { createRepositories } from "@/lib/db";
import { ensureLocalDemoData } from "@/lib/db/fixtures/local-demo-persistence";
import { getDb } from "@/lib/db/server";
import { conversationThreads, conversationMessages, copilotActions } from "@/lib/db/schema";
import type {
  ChatMessage,
  CopilotAction,
  CopilotActionDraft,
  CopilotActionStatus,
  CopilotContext,
} from "./types";

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

function isActionStatus(value: unknown): value is CopilotActionStatus {
  return (
    value === "pending" ||
    value === "applying" ||
    value === "applied" ||
    value === "failed" ||
    value === "dismissed"
  );
}

function isActionConfidence(value: unknown): value is CopilotAction["confidence"] {
  return value === "low" || value === "medium" || value === "high";
}

function getActionResult(value: unknown): CopilotAction["result"] {
  if (!isRecord(value) || typeof value.message !== "string") {
    return null;
  }

  return {
    message: value.message,
    affectedPaths: Array.isArray(value.affectedPaths)
      ? value.affectedPaths.filter((item): item is string => typeof item === "string")
      : [],
    data: isRecord(value.data) ? value.data : undefined,
  };
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
    if (isActionStatus(domainStatus)) {
      return domainStatus;
    }
  }

  if (action.status === "running") {
    return "applying";
  }

  if (action.status === "completed") {
    return "applied";
  }

  if (action.status === "failed") {
    return "failed";
  }

  return "pending";
}

function mapDbActionStatus(status: CopilotAction["status"]): ActionRecord["status"] {
  switch (status) {
    case "applying":
      return "running";
    case "applied":
      return "completed";
    case "dismissed":
    case "failed":
      return "failed";
    default:
      return "queued";
  }
}

function getMappedActionTarget(metadata: Record<string, unknown>): CopilotAction["target"] {
  if (!isRecord(metadata.target)) {
    return undefined;
  }

  const entityType = metadata.target.entityType;
  if (
    entityType !== "weekly_route_item" &&
    entityType !== "planning_day" &&
    entityType !== "today_lesson" &&
    entityType !== "lesson_session" &&
    entityType !== "tracking_note"
  ) {
    return undefined;
  }

  return {
    entityType,
    entityId:
      typeof metadata.target.entityId === "string" ? metadata.target.entityId : undefined,
    secondaryEntityId:
      typeof metadata.target.secondaryEntityId === "string"
        ? metadata.target.secondaryEntityId
        : undefined,
    date: typeof metadata.target.date === "string" ? metadata.target.date : undefined,
  };
}

function getMappedActionBase(action: ActionRecord, metadata: Record<string, unknown>) {
  return {
    id: action.id,
    label:
      typeof metadata.label === "string"
        ? metadata.label
        : action.targetType ?? action.actionType,
    description:
      typeof metadata.description === "string"
        ? metadata.description
        : typeof metadata.label === "string"
          ? metadata.label
          : action.targetType ?? action.actionType,
    rationale: typeof metadata.rationale === "string" ? metadata.rationale : undefined,
    confidence: isActionConfidence(metadata.confidence) ? metadata.confidence : undefined,
    requiresApproval: metadata.requiresApproval !== false,
    target: getMappedActionTarget(metadata),
    status: getDomainActionStatus(action),
    createdAt: toIsoString(action.createdAt),
    lineageId: typeof metadata.lineageId === "string" ? metadata.lineageId : undefined,
    error: typeof metadata.error === "string" ? metadata.error : null,
    result: getActionResult(action.output),
  };
}

function mapAction(action: ActionRecord): CopilotAction | null {
  const metadata = isRecord(action.metadata) ? action.metadata : {};
  const base = getMappedActionBase(action, metadata);

  switch (action.actionType) {
    case "planning.adjust_day_load":
      return {
        ...base,
        kind: "planning.adjust_day_load",
        payload: (isRecord(action.input)
          ? action.input
          : {}) as Extract<CopilotAction, { kind: "planning.adjust_day_load" }>["payload"],
      };
    case "planning.defer_or_move_item":
      return {
        ...base,
        kind: "planning.defer_or_move_item",
        payload: (isRecord(action.input)
          ? action.input
          : {}) as Extract<CopilotAction, { kind: "planning.defer_or_move_item" }>["payload"],
      };
    case "planning.generate_today_lesson":
      return {
        ...base,
        kind: "planning.generate_today_lesson",
        payload: (isRecord(action.input)
          ? action.input
          : {}) as Extract<CopilotAction, { kind: "planning.generate_today_lesson" }>["payload"],
      };
    case "tracking.record_note":
      return {
        ...base,
        kind: "tracking.record_note",
        payload: (isRecord(action.input)
          ? action.input
          : {}) as Extract<CopilotAction, { kind: "tracking.record_note" }>["payload"],
      };
    default:
      return null;
  }
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
  private ensureThreadAccess(params: {
    thread: ThreadRecord;
    householdId: string;
    learnerId?: string | null;
  }) {
    if (params.thread.organizationId !== params.householdId) {
      throw new Error("Session not found.");
    }

    if (params.learnerId && params.thread.learnerId && params.thread.learnerId !== params.learnerId) {
      throw new Error("Session not found.");
    }
  }

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
      actions: actions
        .map(mapAction)
        .filter((action): action is CopilotAction => action !== null),
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

  async getSession(
    id: string,
    options: { householdId: string; learnerId?: string | null },
  ): Promise<CopilotSession | null> {
    await ensureLocalDemoData();

    const thread = await getCopilotRepo().findThreadById(id);
    if (!thread) {
      return null;
    }

    this.ensureThreadAccess({
      thread,
      householdId: options.householdId,
      learnerId: options.learnerId,
    });

    return thread ? this.hydrateSession(thread) : null;
  }

  async listSessions(householdId: string): Promise<CopilotSession[]> {
    await ensureLocalDemoData();

    const threads = await getCopilotRepo().listThreadsForOrganization(householdId);
    return Promise.all(threads.map((thread) => this.hydrateSession(thread)));
  }

  async appendMessage(
    sessionId: string,
    message: ChatMessage,
    options: { householdId: string; learnerId?: string | null },
  ): Promise<CopilotSession> {
    await ensureLocalDemoData();

    const thread = await getCopilotRepo().findThreadById(sessionId);
    if (!thread) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    this.ensureThreadAccess({
      thread,
      householdId: options.householdId,
      learnerId: options.learnerId,
    });

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
    action: CopilotActionDraft,
    options: { householdId: string; learnerId?: string | null },
    extra?: { lineageId?: string },
  ): Promise<CopilotAction> {
    await ensureLocalDemoData();

    const thread = await getCopilotRepo().findThreadById(sessionId);
    if (!thread) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    this.ensureThreadAccess({
      thread,
      householdId: options.householdId,
      learnerId: options.learnerId,
    });

    const created = await getCopilotRepo().createAction({
      threadId: sessionId,
      messageId: null,
      actionType: action.kind,
      status: "queued",
      targetType: action.label,
      targetId:
        action.target?.entityId ??
        ("weeklyRouteItemId" in action.payload ? action.payload.weeklyRouteItemId : null),
      input: action.payload,
      output: {},
      metadata: {
        label: action.label,
        description: action.description,
        rationale: action.rationale ?? null,
        confidence: action.confidence ?? null,
        requiresApproval: action.requiresApproval,
        target: action.target ?? null,
        suggestionId: action.id,
        lineageId: extra?.lineageId ?? null,
        domainStatus: "pending",
      },
    });
    await getCopilotRepo().updateThread(sessionId, {});

    const mapped = mapAction(created);
    if (!mapped) {
      throw new Error(`Unsupported action kind persisted: ${created.actionType}`);
    }

    return mapped;
  }

  async updateActionStatus(
    sessionId: string,
    actionId: string,
    input: {
      status: CopilotAction["status"];
      result?: CopilotAction["result"];
      error?: string | null;
    },
    options: { householdId: string; learnerId?: string | null },
  ): Promise<CopilotAction> {
    await ensureLocalDemoData();

    const thread = await getCopilotRepo().findThreadById(sessionId);
    if (!thread) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    this.ensureThreadAccess({
      thread,
      householdId: options.householdId,
      learnerId: options.learnerId,
    });

    const action = await getCopilotRepo().findActionById(actionId);
    if (!action || action.threadId !== sessionId) {
      throw new Error(`Action not found: ${actionId}`);
    }

    const metadata = isRecord(action.metadata) ? action.metadata : {};
    const updated = await getCopilotRepo().updateAction(actionId, {
      status: mapDbActionStatus(input.status),
      output: input.result ?? action.output,
      metadata: {
        ...metadata,
        domainStatus: input.status,
        error: input.error ?? null,
      },
    });
    await getCopilotRepo().updateThread(sessionId, {});

    if (!updated) {
      throw new Error(`Action not found: ${actionId}`);
    }

    const mapped = mapAction(updated);
    if (!mapped) {
      throw new Error(`Unsupported action kind persisted: ${updated.actionType}`);
    }

    return mapped;
  }
}

let _store: DbCopilotStore | null = null;

export function getCopilotStore(): DbCopilotStore {
  if (!_store) {
    _store = new DbCopilotStore();
  }

  return _store;
}
