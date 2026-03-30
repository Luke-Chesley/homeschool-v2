/**
 * Copilot store — persists chat sessions and copilot actions.
 *
 * Chat output (streaming messages) is kept SEPARATE from durable action
 * records. This makes it easy to archive conversations without confusing
 * them with system-state changes.
 *
 * Integration point: replace in-memory store with Supabase queries once
 * plan 02 is merged.
 */

import { randomUUID } from "crypto";
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

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

class InMemoryCopilotStore {
  private sessions = new Map<string, CopilotSession>();

  createSession(
    householdId: string,
    title: string,
    context?: CopilotContext
  ): CopilotSession {
    const now = new Date().toISOString();
    const session: CopilotSession = {
      id: randomUUID(),
      householdId,
      title,
      messages: [],
      context,
      actions: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): CopilotSession | null {
    return this.sessions.get(id) ?? null;
  }

  listSessions(householdId: string): CopilotSession[] {
    return [...this.sessions.values()]
      .filter((s) => s.householdId === householdId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  appendMessage(sessionId: string, message: ChatMessage): CopilotSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const updated: CopilotSession = {
      ...session,
      messages: [...session.messages, { ...message, createdAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  appendAction(sessionId: string, action: Omit<CopilotAction, "id" | "createdAt" | "status">): CopilotAction {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const newAction: CopilotAction = {
      ...action,
      id: randomUUID(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const updated = {
      ...session,
      actions: [...session.actions, newAction],
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, updated);
    return newAction;
  }

  updateActionStatus(
    sessionId: string,
    actionId: string,
    status: CopilotAction["status"]
  ): CopilotAction {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const action = session.actions.find((a) => a.id === actionId);
    if (!action) throw new Error(`Action not found: ${actionId}`);
    const updated = { ...action, status };
    const updatedSession = {
      ...session,
      actions: session.actions.map((a) => (a.id === actionId ? updated : a)),
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, updatedSession);
    return updated;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _store: InMemoryCopilotStore | null = null;

export function getCopilotStore(): InMemoryCopilotStore {
  if (!_store) _store = new InMemoryCopilotStore();
  return _store;
}
