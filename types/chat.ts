export type ChatAgentStatus = "ONLINE" | "IDLE" | "BUSY" | "OFFLINE";
export type ChatModelStatus = "ACTIVE" | "IDLE" | "OFFLINE" | "ERROR";
export type ChatSessionStatus = "ACTIVE" | "ARCHIVED";
export type ChatMessageSender = "USER" | "AGENT" | "SYSTEM";
export type ChatMessageType = "text" | "markdown" | "code";

export type ChatAgent = {
  id: string;
  name: string;
  role: string;
  status: ChatAgentStatus;
  description: string;
  initials: string;
  avatarTone: "cyan" | "violet" | "emerald" | "amber" | "sky";
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  status: ChatModelStatus;
  description: string;
  contextWindow: string;
};

export type ChatSession = {
  id: string;
  title: string;
  agentId: string;
  modelId: string;
  status: ChatSessionStatus;
  startedAt: string;
  updatedAt: string;
  messageCount: number;
  tokensUsed: number;
  contextWindow: number;
  shared: boolean;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  sender: ChatMessageSender;
  type: ChatMessageType;
  content: string;
  timestamp: string;
  model: string;
  tokens: number;
};

export type ChatBootstrapData = {
  agents: ChatAgent[];
  models: ChatModel[];
  chatSessions: ChatSession[];
  messages: ChatMessage[];
};
