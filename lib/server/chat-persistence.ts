import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { chatMockData } from "@/lib/data/chat";
import { getLiveModels } from "@/lib/server/live-models";
import { ChatAgent, ChatBootstrapData, ChatMessage, ChatModel, ChatSession } from "@/types/chat";
import { Model } from "@/types/model";

const execFileAsync = promisify(execFile);
const dataDir = path.join(process.cwd(), ".jarvis-data");
const chatPath = path.join(dataDir, "chat.json");

type PersistedChat = Pick<ChatBootstrapData, "chatSessions" | "messages">;

const avatarTones: ChatAgent["avatarTone"][] = ["cyan", "violet", "emerald", "amber", "sky"];

type OpenClawAgentListItem = {
  id: string;
  identityName?: string;
  identityEmoji?: string;
  workspace?: string;
  model?: string;
  bindings?: number;
  isDefault?: boolean;
};

function chatModelStatus(status: Model["status"]): ChatModel["status"] {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "OFFLINE") return "OFFLINE";
  if (status === "ERROR") return "ERROR";
  return "IDLE";
}

function toChatModel(model: Model): ChatModel {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    status: chatModelStatus(model.status),
    description: model.description,
    contextWindow: model.contextWindow
  };
}

async function getRuntimeChatAgents(): Promise<ChatAgent[]> {
  try {
    const { stdout } = await execFileAsync("openclaw", ["agents", "list", "--json"], { timeout: 10000, maxBuffer: 1024 * 1024 });
    const parsed = JSON.parse(stdout) as unknown;
    if (!Array.isArray(parsed)) return chatMockData.agents;

    return (parsed as OpenClawAgentListItem[]).map((agent, index) => ({
      id: `openclaw-${agent.id}`,
      name: agent.identityName ? `${agent.identityName}${agent.identityEmoji ? ` ${agent.identityEmoji}` : ""}` : `OpenClaw ${agent.id}`,
      role: agent.isDefault ? "Default Local Agent" : "Local Agent",
      status: "ONLINE",
      description: `${agent.bindings ?? 0} bindings in ${agent.workspace ?? "workspace"}${agent.model ? ` • Model: ${agent.model}` : ""}`,
      initials: (agent.identityName ?? agent.id).split(/[^a-z0-9]+/i).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "AG",
      avatarTone: avatarTones[index % avatarTones.length]
    }));
  } catch {
    return chatMockData.agents;
  }
}

async function getRuntimeChatModels(): Promise<ChatModel[]> {
  try {
    return (await getLiveModels()).map(toChatModel);
  } catch {
    return chatMockData.models;
  }
}

async function readPersistedChat(): Promise<PersistedChat> {
  try {
    const raw = await readFile(chatPath, "utf8");
    const parsed = JSON.parse(raw) as PersistedChat;
    return {
      chatSessions: Array.isArray(parsed.chatSessions) ? parsed.chatSessions : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : []
    };
  } catch {
    return {
      chatSessions: [],
      messages: []
    };
  }
}

async function writePersistedChat(data: PersistedChat) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(chatPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function getChatBootstrap(): Promise<ChatBootstrapData> {
  const [persisted, agents, models] = await Promise.all([
    readPersistedChat(),
    getRuntimeChatAgents(),
    getRuntimeChatModels()
  ]);

  const agentIds = new Set(agents.map((agent) => agent.id));
  const modelIds = new Set(models.map((model) => model.id));
  const chatSessions = persisted.chatSessions.filter((session) => agentIds.has(session.agentId) && modelIds.has(session.modelId));
  const sessionIds = new Set(chatSessions.map((session) => session.id));

  return {
    agents,
    models,
    chatSessions,
    messages: persisted.messages.filter((message) => sessionIds.has(message.sessionId))
  };
}

export async function saveChatMessage(session: ChatSession, userMessage: ChatMessage, agentMessage: ChatMessage) {
  const persisted = await readPersistedChat();
  const existingSession = persisted.chatSessions.find((item) => item.id === session.id);
  const nextSessions = existingSession
    ? persisted.chatSessions.map((item) => (item.id === session.id ? session : item))
    : [session, ...persisted.chatSessions];

  const nextMessages = [...persisted.messages, userMessage, agentMessage];
  await writePersistedChat({ chatSessions: nextSessions, messages: nextMessages });

  return {
    chatSessions: nextSessions,
    messages: nextMessages
  };
}

export async function saveChatSnapshot(chatSessions: ChatSession[], messages: ChatMessage[]) {
  await writePersistedChat({ chatSessions, messages });
}
