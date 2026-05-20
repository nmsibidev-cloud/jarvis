"use client";

import { create } from "zustand";

import { chatMockData } from "@/lib/data/chat";
import { ChatAgent, ChatBootstrapData, ChatMessage, ChatMessageType, ChatModel, ChatSession } from "@/types/chat";

type CreateSessionOptions = {
  agentId?: string;
  modelId?: string;
  title?: string;
};

type ChatStoreState = {
  agents: ChatAgent[];
  models: ChatModel[];
  sessions: ChatSession[];
  messages: ChatMessage[];
  selectedAgentId: string;
  selectedSessionId: string;
  draftMessage: string;
  typingSessionIds: string[];
  hydrate: (data: ChatBootstrapData) => void;
  setDraftMessage: (value: string) => void;
  selectAgent: (agentId: string) => void;
  selectSession: (sessionId: string) => void;
  createSession: (options?: CreateSessionOptions) => string | null;
  sendUserMessage: (content: string) => string | null;
  sendAgentMessage: (sessionId: string, content: string, type?: ChatMessageType) => void;
  clearSession: (sessionId: string) => void;
  switchModel: (sessionId: string, modelId: string) => void;
  setTyping: (sessionId: string, value: boolean) => void;
};

function estimateTokens(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(8, Math.round(words * 1.4));
}

function formatStartedAt(date = new Date()) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function parseContextWindow(value: string) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)([kKmM]?)$/);
  if (!match) return 128000;

  const amount = Number(match[1] ?? 128);
  const unit = match[2]?.toUpperCase();
  if (unit === "M") return Math.round(amount * 1_000_000);
  if (unit === "K") return Math.round(amount * 1_000);
  return Math.round(amount);
}

function createFallbackMessage(sessionId: string, modelName: string, content: string): ChatMessage {
  return {
    id: `msg-agent-${Date.now().toString(36)}`,
    sessionId,
    sender: "AGENT",
    type: "markdown",
    content,
    timestamp: "just now",
    model: modelName,
    tokens: estimateTokens(content)
  };
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  agents: chatMockData.agents,
  models: chatMockData.models,
  sessions: chatMockData.chatSessions,
  messages: chatMockData.messages,
  selectedAgentId: chatMockData.chatSessions[0]?.agentId ?? chatMockData.agents[0]?.id ?? "",
  selectedSessionId: chatMockData.chatSessions[0]?.id ?? "",
  draftMessage: "",
  typingSessionIds: [],

  hydrate: (data) => {
    const fallbackAgent = data.agents[0]?.id ?? "";
    const fallbackModel = data.models[0]?.id ?? "";
    const firstSession = data.chatSessions[0] ?? (fallbackAgent && fallbackModel
      ? {
          id: `session-${Date.now().toString(36)}`,
          title: `Chat with ${data.agents[0]?.name ?? "Agent"}`,
          agentId: fallbackAgent,
          modelId: fallbackModel,
          status: "ACTIVE" as const,
          startedAt: formatStartedAt(),
          updatedAt: "just now",
          messageCount: 0,
          tokensUsed: 0,
          contextWindow: parseContextWindow(data.models[0]?.contextWindow ?? "128K"),
          shared: false
        }
      : undefined);

    set({
      agents: data.agents,
      models: data.models,
      sessions: firstSession && data.chatSessions.length === 0 ? [firstSession] : data.chatSessions,
      messages: data.messages,
      selectedAgentId: firstSession?.agentId ?? fallbackAgent,
      selectedSessionId: firstSession?.id ?? "",
      typingSessionIds: []
    });
  },

  setDraftMessage: (value) => set({ draftMessage: value }),

  selectAgent: (agentId) => {
    const state = get();
    const existingSession = state.sessions.find((session) => session.agentId === agentId);

    if (existingSession) {
      set({
        selectedAgentId: agentId,
        selectedSessionId: existingSession.id
      });
      return;
    }

    const createdSessionId = state.createSession({ agentId });
    if (!createdSessionId) return;
    set({
      selectedAgentId: agentId,
      selectedSessionId: createdSessionId
    });
  },

  selectSession: (sessionId) => {
    const session = get().sessions.find((item) => item.id === sessionId);
    if (!session) return;
    set({
      selectedSessionId: session.id,
      selectedAgentId: session.agentId
    });
  },

  createSession: (options) => {
    const state = get();
    const agentId = options?.agentId ?? state.selectedAgentId ?? state.agents[0]?.id;
    if (!agentId) return null;

    const modelId = options?.modelId ?? state.models[0]?.id;
    if (!modelId) return null;

    const model = state.models.find((item) => item.id === modelId);
    const agent = state.agents.find((item) => item.id === agentId);

    const createdSession: ChatSession = {
      id: `session-${Date.now().toString(36)}`,
      title: options?.title?.trim() || `Chat with ${agent?.name ?? "Agent"}`,
      agentId,
      modelId,
      status: "ACTIVE",
      startedAt: formatStartedAt(),
      updatedAt: "just now",
      messageCount: 0,
      tokensUsed: 0,
      contextWindow: parseContextWindow(model?.contextWindow ?? "128K"),
      shared: false
    };

    set({
      sessions: [createdSession, ...state.sessions],
      selectedAgentId: agentId,
      selectedSessionId: createdSession.id
    });

    return createdSession.id;
  },

  sendUserMessage: (content) => {
    const trimmed = content.trim();
    if (!trimmed) return null;

    const state = get();
    const sessionId = state.selectedSessionId || state.createSession({ agentId: state.selectedAgentId });
    if (!sessionId) return null;

    const session = get().sessions.find((item) => item.id === sessionId);
    if (!session) return null;

    const model = get().models.find((item) => item.id === session.modelId);
    const tokens = estimateTokens(trimmed);

    const message: ChatMessage = {
      id: `msg-user-${Date.now().toString(36)}`,
      sessionId,
      sender: "USER",
      type: "text",
      content: trimmed,
      timestamp: "just now",
      model: model?.name ?? "Unknown",
      tokens
    };

    set((current) => ({
      draftMessage: "",
      messages: [...current.messages, message],
      sessions: current.sessions.map((item) =>
        item.id === sessionId
          ? {
              ...item,
              updatedAt: "just now",
              messageCount: item.messageCount + 1,
              tokensUsed: item.tokensUsed + tokens
            }
          : item
      )
    }));

    return sessionId;
  },

  sendAgentMessage: (sessionId, content, type = "markdown") => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const state = get();
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) return;

    const model = state.models.find((item) => item.id === session.modelId);
    const tokens = estimateTokens(trimmed);

    const message = createFallbackMessage(sessionId, model?.name ?? "Unknown", trimmed);
    message.type = type;
    message.tokens = tokens;

    set((current) => ({
      messages: [...current.messages, message],
      sessions: current.sessions.map((item) =>
        item.id === sessionId
          ? {
              ...item,
              updatedAt: "just now",
              messageCount: item.messageCount + 1,
              tokensUsed: item.tokensUsed + tokens
            }
          : item
      )
    }));
  },

  clearSession: (sessionId) => {
    set((state) => ({
      messages: state.messages.filter((message) => message.sessionId !== sessionId),
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messageCount: 0,
              tokensUsed: 0,
              updatedAt: "just now"
            }
          : session
      )
    }));
  },

  switchModel: (sessionId, modelId) => {
    const model = get().models.find((item) => item.id === modelId);
    if (!model) return;

    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              modelId,
              contextWindow: parseContextWindow(model.contextWindow),
              updatedAt: "just now"
            }
          : session
      )
    }));
  },

  setTyping: (sessionId, value) =>
    set((state) => ({
      typingSessionIds: value ? Array.from(new Set([...state.typingSessionIds, sessionId])) : state.typingSessionIds.filter((id) => id !== sessionId)
    }))
}));
