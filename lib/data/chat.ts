import { ChatAgent, ChatBootstrapData, ChatMessage, ChatModel, ChatSession } from "@/types/chat";

// /chat must not ship with fake agents, models, sessions, or example messages.
// Runtime data is loaded in lib/server/chat-persistence.ts from OpenClaw status,
// local Ollama, and configured provider health checks.
export const chatAgents: ChatAgent[] = [];
export const chatModels: ChatModel[] = [];
export const chatSessions: ChatSession[] = [];
export const chatMessages: ChatMessage[] = [];

export const agents = chatAgents;
export const models = chatModels;
export const messages = chatMessages;

export const chatMockData: ChatBootstrapData = {
  agents: chatAgents,
  models: chatModels,
  chatSessions,
  messages: chatMessages
};
